/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import {
  computeTravelCategoryBudget,
  computeTravelReconciliation,
} from "@/lib/services/travel-metrics"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const TRAVEL_BUDGET_CATEGORIES = [
  "FLIGHTS", "ACCOMMODATION", "TRANSPORT", "FOOD", "ACTIVITIES",
  "SHOPPING", "VISA_INSURANCE", "EMERGENCY", "OTHER",
]

export async function getTravelFinances(circleId: string, tripId: string, viewerUserId: string) {
  const [trip, expenses, paidContribs, settlements, members, items, balances] = await Promise.all([
    prisma.travelTrip.findUnique({ where: { id: tripId } }),
    prisma.expense.findMany({
      where: { circleId, deletedAt: null },
      include: {
        paidBy: { select: { name: true } },
        createdBy: { select: { name: true } },
        splits: { include: { user: { select: { name: true } } } },
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.contribution.findMany({ where: { circleId, status: "PAID" } }),
    prisma.settlement.findMany({
      where: { circleId, deletedAt: null },
      include: {
        debtor: { select: { name: true } },
        creditor: { select: { name: true } },
        confirmedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { name: true } } } }),
    prisma.travelItineraryItem.findMany({ where: { tripId, circleId }, select: { id: true, title: true } }),
    (await import("@/lib/services/balance.service")).getCircleBalances(circleId, viewerUserId),
  ])

  const itemTitle = new Map(items.map((i) => [i.id, i.title]))
  const memberNames = new Map<string, string>()
  for (const m of members) memberNames.set(m.userId, m.user?.name ?? m.userId)

  // ── Budget by category ──
  const budgetMap: Record<string, number> = {}
  const raw = (trip?.budgetByCategory as any) || {}
  for (const c of TRAVEL_BUDGET_CATEGORIES) budgetMap[c] = asNum(raw[c])
  const spendByCat: Record<string, number> = {}
  for (const e of expenses) {
    const cat = (e.category || "OTHER").toUpperCase() in budgetMap ? (e.category || "OTHER").toUpperCase() : /^(FLIGHTS|ACCOMMODATION|TRANSPORT|FOOD|ACTIVITIES|SHOPPING|VISA_INSURANCE|EMERGENCY)$/.test((e.category || "").toUpperCase()) ? (e.category || "").toUpperCase() : "OTHER"
    spendByCat[cat] = (spendByCat[cat] || 0) + asNum(e.amount)
  }
  const totalBudget = trip && trip.totalBudget ? asNum(trip.totalBudget) : 0
  const totalSpent = Object.values(spendByCat).reduce((s, v) => s + v, 0)
  const remaining = totalBudget - totalSpent

  const byCategory = computeTravelCategoryBudget(TRAVEL_BUDGET_CATEGORIES.map((c) => ({
    category: c,
    budgeted: budgetMap[c] ?? 0,
    spent: spendByCat[c] ?? 0,
  })))
  const overBudgetByCategory = byCategory.filter((b) => b.budgeted > 0 && b.spent > b.budgeted).map((b) => b.category)
  const topCategory = (Object.entries(spendByCat).sort((a, b) => b[1] - a[1])[0]?.[0]) ?? null
  const spendPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  // Daily spend
  const dailyMap: Record<string, number> = {}
  for (const e of expenses) {
    const d = e.expenseDate.toISOString().slice(0, 10)
    dailyMap[d] = (dailyMap[d] || 0) + asNum(e.amount)
  }
  const daily = Object.keys(dailyMap).sort().map((date) => ({ date, total: Math.round(dailyMap[date] * 100) / 100 }))

  // Per-member shares (their split amounts of shared expenses)
  const shareByUser: Record<string, number> = {}
  for (const e of expenses) for (const s of e.splits) shareByUser[s.userId] = (shareByUser[s.userId] || 0) + asNum(s.amount)

  // Contributions (paid) and expenses paid personally
  const contribByUser: Record<string, number> = {}
  for (const c of paidContribs) contribByUser[c.userId] = (contribByUser[c.userId] || 0) + asNum(c.amount)
  const paidExpByUser: Record<string, number> = {}
  for (const e of expenses) paidExpByUser[e.paidById] = (paidExpByUser[e.paidById] || 0) + asNum(e.amount)

  // Settlements (confirmed)
  const settledGiven: Record<string, number> = {}
  const settledReceived: Record<string, number> = {}
  for (const s of settlements) {
    if (s.status !== "CONFIRMED") continue
    settledGiven[s.debtorId] = (settledGiven[s.debtorId] || 0) + asNum(s.amount)
    settledReceived[s.creditorId] = (settledReceived[s.creditorId] || 0) + asNum(s.amount)
  }

  // Live final reconciliation per member
  const reconciliation = computeTravelReconciliation({ members: members.map((m) => ({ userId: m.userId, name: m.user?.name ?? m.userId })), contributions: contribByUser, paidExpenses: paidExpByUser, share: shareByUser, settledGiven, settledReceived })

  const my = reconciliation.find((r) => r.userId === viewerUserId) || null

  return {
    budget: {
      totalBudget,
      totalSpent,
      remaining,
      spendPct,
      budgetRemainingPct: totalBudget > 0 ? Math.max(0, 100 - spendPct) : 0,
      topCategory,
      overBudgetByCategory,
      byCategory,
    },
    daily,
    perMember: members.map((m) => ({ userId: m.userId, name: m.user?.name ?? m.userId, share: Math.round((shareByUser[m.userId] || 0) * 100) / 100 })),
    reconciliation,
    my: my ? { ...my, totalIOwe: balances.totalIOwe, totalOwedToMe: balances.totalOwedToMe, netBalance: balances.netBalance } : null,
    balances,
    settlements: settlements.map((s) => ({
      id: s.id,
      debtorName: s.debtor?.name ?? s.debtorId,
      creditorName: s.creditor?.name ?? s.creditorId,
      amount: asNum(s.amount),
      note: s.note,
      proofUrl: s.proofUrl,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      confirmedByName: s.confirmedBy?.name ?? null,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: asNum(e.amount),
      category: e.category,
      splitType: e.splitType,
      expenseDate: e.expenseDate.toISOString(),
      receiptUrl: e.receiptUrl,
      travelItemId: e.travelItemId,
      travelItemTitle: e.travelItemId ? itemTitle.get(e.travelItemId) ?? null : null,
      paidByName: e.paidBy?.name ?? null,
      splits: e.splits.map((s) => ({ userId: s.userId, name: s.user?.name ?? s.userId, amount: asNum(s.amount) })),
    })),
  }
}

// Expense creation reuses the shared circle expense engine + private storage URL.
export async function createTravelExpense(circleId: string, userId: string, data: {
  title: string
  amount: number
  category: string
  expenseDate?: string
  paidById?: string
  receiptUrl?: string
  travelItemId?: string | null
  participantIds: string[]
  splitType?: "EQUAL" | "EXACT" | "PERCENTAGE"
  splitsDetail?: Array<{ userId: string; amount?: number; percentage?: number }>
}) {
  const { createExpense, recalculateCircleBalances } = await import("@/lib/services/expense.service")
  const participantIds = data.participantIds.length > 0 ? data.participantIds : [data.paidById || userId]
  let splits: Array<{ userId: string; amount?: number; percentage?: number }>
  if (data.splitType === "EXACT" || data.splitType === "PERCENTAGE") {
    splits = data.splitsDetail?.length ? data.splitsDetail : participantIds.map((uid) => ({ userId: uid }))
  } else {
    splits = participantIds.map((uid) => ({ userId: uid }))
  }
  const splitType = data.splitType || "EQUAL"

  const expense = await createExpense(circleId, userId, {
    title: data.title,
    notes: null,
    amount: data.amount,
    category: data.category,
    splitType,
    expenseDate: data.expenseDate || new Date().toISOString(),
    receiptUrl: data.receiptUrl || null,
    paidById: data.paidById || userId,
    splits,
  })
  if (data.travelItemId) {
    await prisma.expense.update({ where: { id: expense.id }, data: { travelItemId: data.travelItemId } })
  }
  await recalculateCircleBalances(circleId).catch(() => {})
  await createAuditLog({ userId, circleId, action: "TRAVEL_EXPENSE_CREATED", entityType: "Expense", entityId: expense.id, newValues: { title: data.title, amount: data.amount, category: data.category } })
  return expense
}

// Settlement creation reuses balance.service (outstanding-limit + duplicate guard).
export async function createTravelSettlement(circleId: string, userId: string, data: {
  debtorId: string
  creditorId: string
  amount: number
  note?: string
  proofUrl?: string
}) {
  if (data.debtorId === data.creditorId) throw new Error("Debtor and creditor must be different members")
  const { createSettlement } = await import("@/lib/services/balance.service")
  return createSettlement(circleId, userId, {
    debtorId: data.debtorId,
    creditorId: data.creditorId,
    amount: data.amount,
    settlementDate: new Date().toISOString(),
    note: data.note || null,
    proofUrl: data.proofUrl || null,
  })
}