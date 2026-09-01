/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import {
  computeHouseholdBudget,
  computeMyHouseholdPosition,
  computeRentStatus,
  computeHouseholdAlerts,
} from "@/lib/services/household-metrics"
import { getMonthlyBillsSummary, periodOf } from "@/lib/services/household-bills.service"
import { getGroceriesSummary } from "@/lib/services/household-purchase.service"
import { listChores } from "@/lib/services/household-chores.service"
import { getLeaseRooms } from "@/lib/services/household-lease.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const DEFAULT_UTILITIES = ["ELECTRICITY", "WATER", "INTERNET", "UTILITIES", "GAS"]

export async function getHouseholdDashboard(circleId: string, viewerUserId: string) {
  const [config, paidContribs, myContribs, expenses, mySplits, schedules, feeds, memberCount, balances] = await Promise.all([
    prisma.householdConfig.findUnique({ where: { circleId } }),
    prisma.contribution.findMany({ where: { circleId, status: "PAID" } }),
    prisma.contribution.findMany({ where: { circleId, userId: viewerUserId } }),
    prisma.expense.findMany({ where: { circleId, deletedAt: null }, include: { paidBy: { select: { name: true } }, splits: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.expenseSplit.findMany({ where: { userId: viewerUserId, expense: { circleId, deletedAt: null } } }),
    prisma.contributionSchedule.findMany({ where: { circleId, isActive: true, deletedAt: null }, orderBy: { nextDueDate: "asc" } }),
    prisma.feedPost.findMany({ where: { circleId, deletedAt: null }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.circleMember.count({ where: { circleId } }),
    (await import("@/lib/services/balance.service")).getCircleBalances(circleId, viewerUserId),
  ])

  const currency = config?.currency || "ZAR"
  const monthlyRent = config ? asNum(config.monthlyRent) : 0
  const utilities = (config?.utilityCategories as any) as string[] | null
  const utilitySet = new Set((utilities && utilities.length ? utilities : DEFAULT_UTILITIES).map((u) => u.toUpperCase()))

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const inMonth = (d: Date) => d.toISOString().slice(0, 7) === monthKey

  const paidThisMonth = paidContribs.filter((c) => inMonth(c.paymentDate)).reduce((s, c) => s + asNum(c.amount), 0)
  const rentPaidTotal = paidContribs.reduce((s, c) => s + asNum(c.amount), 0)
  const membersPaid = new Set(paidContribs.map((c) => c.userId)).size

  const expensesThisMonth = expenses.filter((e) => inMonth(e.expenseDate))
  const utilitiesThisMonth = expensesThisMonth.filter((e) => utilitySet.has((e.category || "").toUpperCase())).reduce((s, e) => s + asNum(e.amount), 0)
  const sharedThisMonth = expensesThisMonth.filter((e) => !utilitySet.has((e.category || "").toUpperCase())).reduce((s, e) => s + asNum(e.amount), 0)

  const totalSpent = expenses.reduce((s, e) => s + asNum(e.amount), 0)
  const myPaid = myContribs.filter((c) => c.status === "PAID").reduce((s, c) => s + asNum(c.amount), 0)
  const myPending = myContribs.filter((c) => c.status === "PENDING").reduce((s, c) => s + asNum(c.amount), 0)
  const myExpenseShare = mySplits.reduce((s, x) => s + asNum(x.amount), 0)

  const budget = computeHouseholdBudget({ collected: rentPaidTotal, spent: totalSpent, totalBudget: monthlyRent || totalSpent || 1, contributionTarget: monthlyRent, memberCount, membersPaid })
  const pos = computeMyHouseholdPosition({ myPaid, myPending, contributionTarget: monthlyRent, memberCount, myExpenseShare })
  const myAmountDue = Math.round((pos.myShareTarget + myExpenseShare) * 100) / 100
  const myBalance = Math.round((myPaid - myAmountDue) * 100) / 100

  const rentStatus = computeRentStatus({ monthlyRent, paidThisMonth, dueDay: config?.rentDueDay ?? 1 })

  const recentBills = schedules.slice(0, 4).map((s) => ({ id: s.id, name: s.name, amount: asNum(s.amount), dueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null }))
  const nextRentDue = rentStatus.status === "paid" || rentStatus.days >= 0
    ? new Date(now.getFullYear(), now.getMonth(), Math.max(1, Math.min(28, config?.rentDueDay ?? 1))).toISOString()
    : new Date(now.getFullYear(), now.getMonth() + 1, Math.max(1, Math.min(28, config?.rentDueDay ?? 1))).toISOString()

  const myPendingWithoutProof = myContribs.some((c) => c.status === "PENDING" && !c.proofUrl)
  const alerts = computeHouseholdAlerts({
    rentStatus,
    recentBills,
    utilitiesThisMonth,
    monthlyRent,
    membersOwing: balances.allBalances.length,
    pendingProof: myPendingWithoutProof,
  })

  return {
    config: config ? {
      id: config.id,
      name: config.name,
      address: config.address, leaseStart: config.leaseStart ? config.leaseStart.toISOString() : null, leaseEnd: config.leaseEnd ? config.leaseEnd.toISOString() : null,
      monthlyRent, rentDueDay: config.rentDueDay ?? null, deposit: config.deposit != null ? asNum(config.deposit) : null,
      currency, rooms: config.rooms, utilityCategories: utilities || DEFAULT_UTILITIES, bills: config.bills as any,
      rules: config.rules, emergencyContact: config.emergencyContact, landlordContact: config.landlordContact,
    } : null,
    metrics: {
      monthlyHouseholdCost: Math.round((monthlyRent + utilitiesThisMonth + sharedThisMonth) * 100) / 100,
      rentPaid: rentPaidTotal, rentOutstanding: Math.max(0, monthlyRent - paidThisMonth),
      utilitiesThisMonth, sharedThisMonth,
      householdBalance: Math.round((rentPaidTotal - totalSpent) * 100) / 100,
      membersPaid, membersOutstanding: Math.max(0, memberCount - membersPaid), memberCount,
      spentPct: budget.budgetUsedPct, collectionPct: budget.collectionPct,
    },
    rentStatus, nextRentDue,
    my: { amountDue: myAmountDue, amountPaid: myPaid, balance: myBalance, shareTarget: pos.myShareTarget, expenseShare: myExpenseShare, status: pos.myStatus },
    bills: recentBills,
    expenses: expenses.slice(0, 8).map((e) => ({ id: e.id, title: e.title, amount: asNum(e.amount), category: e.category, expenseDate: e.expenseDate.toISOString(), receiptUrl: e.receiptUrl, paidByName: e.paidBy?.name ?? null })),
    balances,
    notices: feeds.map((f) => ({ id: f.id, content: f.content, createdAt: f.createdAt.toISOString(), authorName: f.author?.name ?? null })),
    alerts,
    upcomingBills: recentBills,
    billsSummary: config ? await getMonthlyBillsSummary(circleId, periodOf(new Date()), viewerUserId) : null,
    groceries: config ? await getGroceriesSummary(circleId, viewerUserId) : null,
    chores: config ? await choresSummary(circleId, viewerUserId) : null,
    lease: config ? await leaseSummary(circleId, viewerUserId) : null,
  }
}

async function leaseSummary(circleId: string, viewerUserId: string) {
  const l = await getLeaseRooms(circleId, viewerUserId)
  return {
    leaseStatus: l.leaseStatus,
    daysLeft: l.daysLeft,
    roomsCount: l.rooms.length,
    occupiedCount: l.rooms.filter((r) => !r.vacant).length,
    vacantCount: l.vacantRooms,
    myRoom: l.my?.room?.roomName ?? null,
    myRentShare: l.my?.rentShare ?? 0,
    myDepositStatus: l.my?.deposit?.status ?? null,
    upcomingMoveOuts: l.upcomingMoveOuts.length,
    refundsDue: l.refundsDue.length,
  }
}

async function choresSummary(circleId: string, viewerUserId: string) {
  const l = await listChores(circleId, viewerUserId)
  return {
    myToday: l.today.filter((c: any) => c.isMine).length,
    today: l.today.length,
    completedThisWeek: l.completedThisWeek,
    overdue: l.overdue.length,
    next: l.nextResponsibility ? { title: l.nextResponsibility.title, status: l.nextResponsibility.status, dueDate: l.nextResponsibility.dueDate, isMine: l.nextResponsibility.isMine } : null,
    completionPct: l.completionPct,
    uneven: l.uneven,
  }
}

const CONFIG_FIELDS = ["name", "address", "leaseStart", "leaseEnd", "monthlyRent", "rentDueDay", "deposit", "currency", "rooms", "utilityCategories", "bills", "rules", "emergencyContact", "landlordContact"]

export async function upsertHouseholdConfig(circleId: string, userId: string, data: Record<string, unknown>) {
  const safe: Record<string, unknown> = {}
  for (const k of CONFIG_FIELDS) {
    if (data[k] === undefined) continue
    if (k === "leaseStart" || k === "leaseEnd") safe[k] = data[k] ? new Date(String(data[k])) : null
    else if (k === "monthlyRent" || k === "deposit") safe[k] = data[k] ? asNum(data[k]) : null
    else if (k === "rentDueDay" || k === "rooms") safe[k] = data[k] != null ? Number(data[k]) : null
    else if (k === "utilityCategories" && typeof data[k] === "string") safe[k] = String(data[k]).split(",").map((s) => s.trim()).filter(Boolean)
    else if (data[k] === "" || data[k] === null) safe[k] = null
    else safe[k] = data[k]
  }
  if (!safe.name) safe.name = "Household"
  if (!safe.currency) safe.currency = "ZAR"
  const existing = await prisma.householdConfig.findUnique({ where: { circleId } })
  const config = existing
    ? await prisma.householdConfig.update({ where: { circleId }, data: safe as any })
    : await prisma.householdConfig.create({ data: { circleId, createdById: userId, ...(safe as any) } })
  await createAuditLog({ userId, circleId, action: "HOUSEHOLD_UPDATED", entityType: "HouseholdConfig", entityId: config.id, newValues: safe })
  return config
}

export async function sendHouseholdReminders(circleId: string, userId: string) {
  const config = await prisma.householdConfig.findUnique({ where: { circleId } })
  if (!config) throw new Error("Household not configured")
  const paidIds = new Set((await prisma.contribution.findMany({ where: { circleId, status: "PAID" }, select: { userId: true } })).map((c) => c.userId))
  const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
  const outstanding = members.filter((m) => !paidIds.has(m.userId))
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(outstanding.map((m) => ({
    userId: m.userId, circleId, type: "CONTRIBUTION_REMINDER",
    title: `Rent reminder: ${config.name}`,
    message: "Your household payment is outstanding — please settle it.",
    link: `/circles/${circleId}/household`,
  }))).catch(() => {})
  await createAuditLog({ userId, circleId, action: "HOUSEHOLD_REMINDERS_SENT", entityType: "HouseholdConfig", entityId: config.id, newValues: { count: outstanding.length } })
  return { count: outstanding.length }
}