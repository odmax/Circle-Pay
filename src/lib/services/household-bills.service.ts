/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const BILL_CATEGORIES = ["RENT", "ELECTRICITY", "WATER", "INTERNET", "GAS", "CLEANING", "SECURITY", "STREAMING", "LEVY", "CUSTOM"]

export function computeBillStatus(input: { paid: number; expected: number; dueDate: string | Date | null; today?: Date }): string {
  const expected = Math.max(0, input.expected)
  const paid = Math.max(0, input.paid)
  const today = input.today ?? new Date()
  const due = input.dueDate ? new Date(input.dueDate) : null
  if (expected > 0 && paid >= expected - 0.005) return "PAID"
  if (paid > 0) return "PARTIALLY_PAID"
  if (due && due.getTime() < today.getTime() - 86400000) return "OVERDUE"
  if (due && due <= today) return "DUE"
  return "UPCOMING"
}

export function computeBillShares(input: {
  splitType: string
  expectedAmount: number
  shareConfig: Array<{ userId: string; amount?: number; percentage?: number }> | null
  participatingIds: string[]
}): Record<string, number> {
  const share: Record<string, number> = {}
  const type = (input.splitType || "EQUAL").toUpperCase()
  if (type === "EXACT" && input.shareConfig?.length) {
    for (const s of input.shareConfig) share[s.userId] = asNum(s.amount)
    return share
  }
  if (type === "PERCENTAGE" && input.shareConfig?.length) {
    for (const s of input.shareConfig) share[s.userId] = Math.round(input.expectedAmount * (asNum(s.percentage) / 100) * 100) / 100
    return share
  }
  const ids = input.participatingIds.length ? input.participatingIds : []
  if (ids.length === 0) return share
  const base = Math.floor((input.expectedAmount / ids.length) * 100) / 100
  for (let i = 0; i < ids.length; i++) share[ids[i]] = i === ids.length - 1 ? Math.round((input.expectedAmount - base * (ids.length - 1)) * 100) / 100 : base
  return share
}

export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function dueDateFor(periodKey: string, dueDay: number): Date {
  const [y, m] = periodKey.split("-").map(Number)
  return new Date(y, m - 1, Math.max(1, Math.min(28, dueDay)))
}

// Idempotent monthly generation of bill instances for the current and next month.
export async function ensureBillGeneration(circleId: string) {
  const bills = await prisma.householdRecurringBill.findMany({ where: { circleId, active: true } })
  const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
  const allIds = members.map((m) => m.userId)
  const upserted: string[] = []
  const now = new Date()
  const periods = [periodOf(now), periodOf(new Date(now.getFullYear(), now.getMonth() + 1, 1))]

  for (const bill of bills) {
    let participating: string[] = (bill.participatingMemberIds as any) || []
    if (!Array.isArray(participating) || participating.length === 0) participating = allIds
    for (const p of periods) {
      const existing = await prisma.householdBill.findUnique({ where: { billId_periodKey: { billId: bill.id, periodKey: p } } })
      if (existing) continue
      const shares = computeBillShares({ splitType: bill.splitType, expectedAmount: asNum(bill.expectedAmount), shareConfig: (bill.shareConfig as any) || null, participatingIds: participating })
      const due = bill.dueDay != null ? dueDateFor(p, bill.dueDay) : null
      await prisma.householdBill.create({
        data: {
          billId: bill.id, circleId, periodKey: p,
          expectedAmount: bill.expectedAmount, actualAmount: null, amountPaid: 0,
          status: due && due < now ? "OVERDUE" : "UPCOMING", dueDate: due,
          responsibleMemberId: bill.responsibleMemberId ?? null,
          shares,
        },
      })
      upserted.push(`${bill.id}:${p}`)
    }
  }
  return upserted
}

async function refreshBillStatus(billId: string) {
  const bill = await prisma.householdBill.findUnique({ where: { id: billId } })
  if (!bill) return
  const paid = await prisma.householdBillPayment.aggregate({ where: { billId }, _sum: { amount: true } })
  const expected = Math.max(asNum(bill.actualAmount), asNum(bill.expectedAmount))
  await prisma.householdBill.update({ where: { id: billId }, data: { amountPaid: asNum(paid._sum.amount || 0) } })
  const status = computeBillStatus({ paid: asNum(paid._sum.amount || 0), expected, dueDate: bill.dueDate })
  await prisma.householdBill.update({ where: { id: billId }, data: { status, paidAt: status === "PAID" ? new Date() : null } })
  return status
}

export async function createRecurringBill(circleId: string, userId: string, data: any) {
  const name = (data.name || "").trim()
  if (!name) throw new Error("Bill name is required")
  const bill = await prisma.householdRecurringBill.create({
    data: {
      circleId, createdById: userId,
      name, category: (data.category || "CUSTOM") as any, provider: data.provider ?? null,
      expectedAmount: data.expectedAmount != null ? asNum(data.expectedAmount) : null,
      dueDay: data.dueDay != null ? Number(data.dueDay) : null,
      frequency: data.frequency || "MONTHLY",
      splitType: (data.splitType || "EQUAL").toUpperCase(),
      responsibleMemberId: data.responsibleMemberId ?? null,
      participatingMemberIds: Array.isArray(data.participatingMemberIds) ? data.participatingMemberIds : null,
      shareConfig: Array.isArray(data.shareConfig) ? data.shareConfig : null,
      reminderDays: Array.isArray(data.reminderDays) ? data.reminderDays : [7, 3, 1],
      active: data.active ?? true,
    },
  })
  await ensureBillGeneration(circleId)
  await createAuditLog({ userId, circleId, action: "HOUSEHOLD_BILL_CREATED", entityType: "HouseholdRecurringBill", entityId: bill.id, newValues: { name, category: bill.category } })
  return bill
}

export async function updateRecurringBill(circleId: string, billId: string, userId: string, data: any) {
  const bill = await prisma.householdRecurringBill.findFirst({ where: { id: billId, circleId } })
  if (!bill) throw new Error("Not found")
  const safe: any = {}
  for (const k of ["name", "category", "provider", "expectedAmount", "dueDay", "frequency", "splitType", "responsibleMemberId", "participatingMemberIds", "shareConfig", "reminderDays", "active"]) if (data[k] !== undefined) safe[k] = data[k]
  if (safe.expectedAmount != null) safe.expectedAmount = asNum(safe.expectedAmount)
  if (safe.dueDay != null) safe.dueDay = Number(safe.dueDay)
  if (safe.splitType) safe.splitType = String(safe.splitType).toUpperCase()
  const updated = await prisma.householdRecurringBill.update({ where: { id: billId }, data: safe })
  await ensureBillGeneration(circleId)
  await createAuditLog({ userId, circleId, action: "HOUSEHOLD_BILL_UPDATED", entityType: "HouseholdRecurringBill", entityId: billId, newValues: safe })
  return updated
}

export async function recordBillActual(circleId: string, billId: string, userId: string, isManager: boolean, data: { actualAmount: number; meter?: string; fileUrl?: string }) {
  const bill = await prisma.householdBill.findFirst({ where: { id: billId, circleId }, include: { bill: true } })
  if (!bill) throw new Error("Not found")
  // Authorized: manager or the responsible member (or bill creator).
  const responsible = bill.responsibleMemberId || bill.bill.responsibleMemberId
  if (!isManager && responsible && responsible !== userId) throw new Error("Only the responsible member or a manager can record the actual bill")
  const updated = await prisma.householdBill.update({
    where: { id: billId },
    data: { actualAmount: asNum(data.actualAmount), metadata: { ...(bill.metadata as any || {}), meterNumber: data.meter ?? null, billFileUrl: data.fileUrl ?? null } },
  })
  await refreshBillStatus(billId)
  await createAuditLog({ userId, circleId, action: "HOUSEHOLD_BILL_ACTUAL", entityType: "HouseholdBill", entityId: billId, newValues: { actualAmount: data.actualAmount } })
  await notifyParticipants(circleId, billId, "BILL_ACTUAL_UPLOADED", `Bill actuals recorded: ${bill.bill.name}`, `${asNum(data.actualAmount).toLocaleString()} is the actual amount.`)
  return updated
}

export async function recordBillPayment(circleId: string, billId: string, actorId: string, isManager: boolean, data: { amount: number; payerId?: string; reference?: string; proofUrl?: string }) {
  const bill = await prisma.householdBill.findFirst({ where: { id: billId, circleId }, include: { bill: true } })
  if (!bill) throw new Error("Not found")
  const payerId = data.payerId || actorId
  if (!isManager && payerId !== actorId) throw new Error("You can only record payments for yourself")
  const shares = (bill.shares as any) || {}
  const participants = Object.keys(shares).length ? Object.keys(shares) : [payerId]
  if (!isManager && !participants.includes(payerId)) throw new Error("You are not a participant on this bill")

  const paidAgg = await prisma.householdBillPayment.aggregate({ where: { billId }, _sum: { amount: true } })
  const paid = asNum(paidAgg._sum.amount || 0)
  const expected = Math.max(asNum(bill.actualAmount), asNum(bill.expectedAmount))
  const outstanding = Math.max(0, expected - paid)
  if (data.amount <= 0 || data.amount > outstanding + 0.005) throw new Error(`Amount must be positive and within the outstanding balance of ${outstanding.toLocaleString()}`)

  // Idempotent ledger post through the existing expense engine (one per payment).
  let expenseId: string | null = null
  try {
    const { createExpense } = await import("@/lib/services/expense.service")
    const expense = await createExpense(circleId, actorId, {
      title: `Bill: ${bill.bill.name}`,
      notes: bill.bill.provider || undefined,
      amount: data.amount,
      category: (bill.bill.category || "custom").toLowerCase(),
      splitType: "EQUAL",
      expenseDate: new Date().toISOString(),
      paidById: payerId,
      splits: [{ userId: payerId }],
    })
    expenseId = expense.id
  } catch { /* ledger post failed — record payment without posting to avoid duplicate */ }

  const payment = await prisma.householdBillPayment.create({
    data: { billId, circleId, userId: payerId, amount: data.amount, reference: data.reference ?? null, proofUrl: data.proofUrl ?? null, metadata: { expenseId, actorId } },
  })
  const status = await refreshBillStatus(billId)
  await createAuditLog({ userId: actorId, circleId, action: "HOUSEHOLD_BILL_PAYMENT", entityType: "HouseholdBillPayment", entityId: payment.id, newValues: { amount: data.amount, payerId } })
  const notif = status === "PAID" ? "BILL_SETTLED" : "BILL_PAYMENT_RECORDED"
  await notifyParticipants(circleId, billId, notif, status === "PAID" ? `Bill settled: ${bill.bill.name}` : `Payment recorded: ${bill.bill.name}`, `${data.amount.toLocaleString()} recorded${status === "PAID" ? " — bill fully settled" : ""}.`)
  return { payment, status }
}

async function notifyParticipants(circleId: string, billId: string, type: any, title: string, message: string) {
  const bill = await prisma.householdBill.findUnique({ where: { id: billId }, include: { bill: { select: { responsibleMemberId: true } } } })
  if (!bill) return
  const shares = (bill.shares as any) || {}
  const ids = new Set<string>([...(Object.keys(shares)), ...(bill.bill.responsibleMemberId ? [bill.bill.responsibleMemberId] : [])])
  if (ids.size === 0) return
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(Array.from(ids).map((userId) => ({ userId, circleId, type, title, message, link: `/circles/${circleId}/household` }))).catch(() => {})
}

// Monthly summary + member view for the dashboard.
export async function getMonthlyBillsSummary(circleId: string, periodKey: string, viewerUserId: string) {
  await ensureBillGeneration(circleId)
  const bills = await prisma.householdBill.findMany({
    where: { circleId, periodKey },
    include: { bill: true, payments: { orderBy: { createdAt: "asc" } } },
    orderBy: { dueDate: "asc" },
  })
  const now = new Date()
  const weekMs = 7 * 86400000

  const mapped = bills.map((b) => {
    const expected = Math.max(asNum(b.actualAmount), asNum(b.expectedAmount))
    const shares = (b.shares as any) || {}
    const myShare = asNum(shares[viewerUserId])
    const myPaid = b.payments.filter((p) => p.userId === viewerUserId).reduce((s, p) => s + asNum(p.amount), 0)
    return {
      id: b.id,
      billId: b.billId,
      name: b.bill.name,
      category: b.bill.category,
      provider: b.bill.provider,
      status: b.status,
      expected,
      actual: b.actualAmount != null ? asNum(b.actualAmount) : null,
      paid: asNum(b.amountPaid),
      outstanding: Math.max(0, expected - asNum(b.amountPaid)),
      dueDate: b.dueDate ? b.dueDate.toISOString() : null,
      responsibleMemberId: b.responsibleMemberId || b.bill.responsibleMemberId,
      myShare,
      myPaid,
      myOutstanding: Math.max(0, myShare - myPaid),
      billFileUrl: (b.metadata as any)?.billFileUrl ?? null,
      billf: (b.metadata as any)?.meterNumber ?? null,
    }
  })

  const utilities = new Set(["ELECTRICITY", "WATER", "INTERNET", "GAS"])
  const utilitiesThisMonth = mapped.filter((b) => utilities.has(b.category)).reduce((s, b) => s + (b.actual ?? b.expected), 0)
  const due = (b: typeof mapped[number], w: number) => b.dueDate && b.outstanding > 0 && new Date(b.dueDate).getTime() - now.getTime() <= w
  const today = new Date(new Date().toDateString()).getTime()
  const overdue = mapped.filter((b) => b.outstanding > 0 && b.dueDate && new Date(b.dueDate).getTime() < today)
  const dueThisWeek = mapped.filter((b) => due(b, weekMs))
  const myUpcoming = mapped.filter((b) => b.myOutstanding > 0 && b.dueDate && new Date(b.dueDate).getTime() - now.getTime() <= weekMs)
  const nextDeadline = mapped.filter((b) => b.outstanding > 0 && b.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0] ?? null

  return {
    period: periodKey,
    utilitiesThisMonth,
    paidTotal: mapped.reduce((s, b) => s + b.paid, 0),
    outstandingTotal: mapped.reduce((s, b) => s + b.outstanding, 0),
    overdueCount: overdue.length,
    dueThisWeekCount: dueThisWeek.length,
    nextDeadline: nextDeadline ? { name: nextDeadline.name, dueDate: nextDeadline.dueDate } : null,
    myUpcoming: myUpcoming.map((b) => ({ id: b.id, name: b.name, myShare: b.myShare, myPaid: b.myPaid, myOutstanding: b.myOutstanding, dueDate: b.dueDate })),
    bills: mapped,
  }
}

// Daily reminder sweep — deduped per day via a sentinel on the bill instance.
export async function sweepHouseholdBills(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "HOUSEMATE") return []
  await ensureBillGeneration(circleId).catch(() => {})
  const today = new Date(new Date().toDateString())
  const monthKey = periodOf(new Date())
  const bills = await prisma.householdBill.findMany({ where: { circleId, periodKey: monthKey }, include: { bill: true } })
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  const notified: string[] = []
  for (const b of bills) {
    const expected = Math.max(asNum(b.actualAmount), asNum(b.expectedAmount))
    const shareIds = Object.keys((b.shares as any) || {})
    const target = new Set<string>([...shareIds, ...(b.bill.responsibleMemberId ? [b.bill.responsibleMemberId] : [])])
    if (target.size === 0) continue
    const days = b.dueDate ? Math.round((new Date(b.dueDate).getTime() - today.getTime()) / 86400000) : Infinity
    const stage = days < 0 ? "overdue" : days === 0 ? "due" : days === 1 ? "d1" : days <= 3 ? "d3" : days <= 7 ? "d7" : null
    if (!stage) continue
    const sent = (b.metadata as any)?.reminders || {}
    if (sent[stage] === today.toISOString().slice(0, 10)) continue
    await createBulkNotifications(Array.from(target).map((userId) => ({
      userId, circleId,
      type: stage === "overdue" ? "BILL_OVERDUE" : "BILL_DUE",
      title: stage === "overdue" ? `Bill overdue: ${b.bill.name}` : `Bill due: ${b.bill.name}`,
      message: stage === "overdue" ? `This bill was due ${Math.abs(days)} day(s) ago.` : days === 0 ? `Due today (${Math.round(expected).toLocaleString()}).` : `Due in ${days} day(s) — ${Math.round(expected).toLocaleString()}.`,
      link: `/circles/${circleId}/household`,
    }))).catch(() => {})
    await prisma.householdBill.update({ where: { id: b.id }, data: { metadata: { ...(b.metadata as any || {}), reminders: { ...sent, [stage]: today.toISOString().slice(0, 10) } } } })
    notified.push(`${b.id}:${stage}`)
  }
  return notified
}