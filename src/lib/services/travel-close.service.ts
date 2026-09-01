/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { getTravelFinances } from "@/lib/services/travel-finance.service"

export interface TravelBlocker {
  id: string
  level: "critical" | "warning"
  title: string
  description: string
}

export interface TravelStatementRow {
  userId: string
  name: string
  contributions: number
  memberPaidExpenses: number
  share: number
  settledGiven: number
  settledReceived: number
  refundAvailable: number
  amountOwed: number
  finalBalance: number
}

export function buildStatementRows(input: {
  members: Array<{ userId: string; name: string }>
  reconciliation: Array<{ userId: string; name: string; contributions: number; memberPaidExpenses: number; share: number; settledGiven: number; settledReceived: number; finalBalance: number }>
}): TravelStatementRow[] {
  return input.reconciliation.map((r) => {
    const finalBalance = Math.round(r.finalBalance * 100) / 100
    return {
      userId: r.userId,
      name: r.name,
      contributions: r.contributions,
      memberPaidExpenses: r.memberPaidExpenses,
      share: r.share,
      settledGiven: r.settledGiven,
      settledReceived: r.settledReceived,
      refundAvailable: Math.max(0, finalBalance),
      amountOwed: Math.max(0, -finalBalance),
      finalBalance,
    }
  })
}

export async function getCloseReview(circleId: string, tripId: string, viewerUserId: string) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")
  const finances = await getTravelFinances(circleId, tripId, viewerUserId)

  const totalContributions = Math.round(finances.reconciliation.reduce((s, r) => s + r.contributions, 0) * 100) / 100
  const totalSpent = finances.budget.totalSpent
  const totalBudget = finances.budget.totalBudget
  const variance = totalBudget - totalSpent
  const collectionRate = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  const totalSettlements = Math.round(finances.settlements.filter((s) => s.status === "CONFIRMED").reduce((s, x) => s + x.amount, 0) * 100) / 100
  const durationDays = trip.startDate && trip.endDate ? Math.max(0, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000)) : 0
  const topCategories = [...finances.budget.byCategory].sort((a, b) => b.spent - a.spent).slice(0, 5).map((c) => c.category)

  const rows = buildStatementRows({
    members: finances.perMember.map((m) => ({ userId: m.userId, name: m.name })),
    reconciliation: finances.reconciliation,
  })
  const remainingFunds = Math.round(rows.reduce((s, r) => s + Math.max(0, r.finalBalance), 0) * 100) / 100
  const refundsDue = rows.filter((r) => r.refundAvailable > 0).map((r) => ({ userId: r.userId, name: r.name, amount: r.refundAvailable }))
  const membersOwing = rows.filter((r) => r.amountOwed > 0).map((r) => ({ userId: r.userId, name: r.name, amount: r.amountOwed }))

  const memberCount = Math.max(1, finances.perMember.length)
  const perPersonCost = Math.round((totalSpent / memberCount) * 100) / 100
  const participationCount = finances.reconciliation.filter((r) => r.contributions > 0 || r.memberPaidExpenses > 0 || r.share > 0).length

  const hard: TravelBlocker[] = []
  const soft: TravelBlocker[] = []
  if (finances.balances.allBalances.length > 0) hard.push({ id: "balances", level: "critical", title: "Unsettled balances", description: `${finances.balances.allBalances.length} member balance(s) are still outstanding.` })
  const pendingSettlements = finances.settlements.filter((s) => s.status === "PENDING").length
  if (pendingSettlements > 0) hard.push({ id: "pending-settlements", level: "critical", title: "Pending settlements", description: `${pendingSettlements} settlement(s) await confirmation.` })
  const rejectedSettlements = finances.settlements.filter((s) => s.status === "REJECTED").length
  if (rejectedSettlements > 0) hard.push({ id: "rejected-settlements", level: "critical", title: "Rejected settlements", description: `${rejectedSettlements} settlement(s) were rejected and not resolved.` })
  const missingReceipts = finances.expenses.filter((e) => !e.receiptUrl).length
  if (missingReceipts > 0) soft.push({ id: "receipts", level: "warning", title: "Missing receipts", description: `${missingReceipts} expense(s) have no receipt uploaded.` })
  if (remainingFunds > 0) soft.push({ id: "refunds", level: "warning", title: "Refunds available", description: `${remainingFunds.toLocaleString()} is left to refund to members.` })

  const progressByStatus: Record<string, number> = { COMPLETED: 15, RECONCILING: 45, PENDING_SETTLEMENT: 75, CLOSED: 100 }
  const myRow = rows.find((r) => r.userId === viewerUserId) || null

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate ? trip.startDate.toISOString() : null,
      endDate: trip.endDate ? trip.endDate.toISOString() : null,
      status: trip.status,
      reconciled: trip.reconcilingAt ? trip.reconcilingAt.toISOString() : null,
      finalizedAt: trip.finalizedAt ? trip.finalizedAt.toISOString() : null,
      tripSummary: trip.tripSummary as any,
    },
    statusProgress: progressByStatus[trip.status] ?? 0,
    totals: { totalContributions, totalSpent, totalBudget, variance, collectionRate, totalSettlements, remainingFunds, topCategories, durationDays, perPersonCost, participationCount, memberCount },
    rows,
    my: myRow,
    refundsDue,
    membersOwing,
    blockers: { hard, soft },
  }
}

function workflowGuard(trip: { status: string }, allowed: string[], action: string) {
  if (!allowed.includes(trip.status)) throw new Error(`Trip must be ${allowed.join(" or ")} to ${action} (current: ${trip.status})`)
}

async function notifyMembers(circleId: string, tripName: string, type: any, title: string, message: string, link?: string) {
  const { notifyCircleMembers } = await import("@/lib/services/notification.service")
  await notifyCircleMembers(circleId, null, { type, title, message, link: link || null }).catch(() => {})
}

export async function startTripReconciliation(circleId: string, tripId: string, userId: string) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")
  workflowGuard(trip, ["COMPLETED"], "start reconciliation")
  const updated = await prisma.travelTrip.update({ where: { id: tripId }, data: { status: "RECONCILING", reconcilingAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "TRAVEL_RECONCILING", entityType: "TravelTrip", entityId: tripId, oldValues: { status: trip.status }, newValues: { status: "RECONCILING" } })
  await notifyMembers(circleId, trip.name, "FEED_POST_CREATED", `Reconciliation started: ${trip.name}`, "The final trip reconciliation has begun.")
  return updated
}

export async function startTripSettlementPhase(circleId: string, tripId: string, userId: string) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")
  workflowGuard(trip, ["RECONCILING"], "start the settlement phase")
  const updated = await prisma.travelTrip.update({ where: { id: tripId }, data: { status: "PENDING_SETTLEMENT", pendingSettlementAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "TRAVEL_PENDING_SETTLEMENT", entityType: "TravelTrip", entityId: tripId, oldValues: { status: trip.status }, newValues: { status: "PENDING_SETTLEMENT" } })
  const review = await getCloseReview(circleId, tripId, userId)
  const { createNotification } = await import("@/lib/services/notification.service")
  for (const o of review.membersOwing) {
    await createNotification({ userId: o.userId, circleId, type: "SETTLEMENT_REQUESTED", title: `Settlement required: ${trip.name}`, message: `You owe ${o.amount.toLocaleString()} in final trip settlements.`, link: `/circles/${circleId}/travel-budget` }).catch(() => {})
  }
  for (const r_ of review.refundsDue) {
    await createNotification({ userId: r_.userId, circleId, type: "FEED_POST_CREATED", title: `Refund available: ${trip.name}`, message: `You are owed ${r_.amount.toLocaleString()} from the trip.`, link: `/circles/${circleId}/trip-close` }).catch(() => {})
  }
  return updated
}

export async function finalizeTrip(circleId: string, tripId: string, userId: string, force?: boolean) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")
  workflowGuard(trip, ["PENDING_SETTLEMENT"], "finalize")
  if (trip.status === "CLOSED") throw new Error("Trip is already final")

  const review = await getCloseReview(circleId, tripId, userId)
  if (!force && review.blockers.hard.length > 0) {
    throw new Error(`Trip cannot be finalized: ${review.blockers.hard.map((b) => b.title).join(", ")}. Resolve these first or reopen to adjust.`)
  }

  const summary = {
    totalContributions: review.totals.totalContributions,
    totalSpent: review.totals.totalSpent,
    totalBudget: review.totals.totalBudget,
    variance: review.totals.variance,
    collectionRate: review.totals.collectionRate,
    totalSettlements: review.totals.totalSettlements,
    remainingFunds: review.totals.remainingFunds,
    topCategories: review.totals.topCategories,
    durationDays: review.totals.durationDays,
    perPersonCost: review.totals.perPersonCost,
    participationCount: review.totals.participationCount,
    memberCount: review.totals.memberCount,
    finalizedAt: new Date().toISOString(),
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.travelTrip.update({
      where: { id: tripId },
      data: { status: "CLOSED", closedAt: new Date(), finalizedAt: new Date(), tripSummary: summary as any },
    })
    for (const r of review.rows) {
      // Idempotent per-member snapshot (immutable finalized figures).
      await tx.travelStatementSnapshot.upsert({
        where: { tripId_userId: { tripId, userId: r.userId } },
        create: { circleId, tripId, userId: r.userId, name: r.name, data: { ...r, ...summary } },
        update: { circleId, tripId, userId: r.userId, name: r.name, data: { ...r, ...summary } },
      })
    }
    return tripId
  })

  await createAuditLog({ userId, circleId, action: "TRAVEL_FINALIZED", entityType: "TravelTrip", entityId: tripId, oldValues: { status: trip.status }, newValues: { status: "CLOSED", summary } })
  await notifyMembers(circleId, trip.name, "FEED_POST_CREATED", `Trip finalized: ${trip.name}`, "Final statements are ready.", `/circles/${circleId}/trip-close`)
  const { createNotification } = await import("@/lib/services/notification.service")
  for (const r of review.rows) {
    await createNotification({ userId: r.userId, circleId, type: "STATEMENT_READY", title: `Your trip statement is ready`, message: `${trip.name} — download your final statement.`, link: `/circles/${circleId}/trip-close` }).catch(() => {})
  }
  return updated
}

// Audited reopen: never silently mutate finalized history — reopen and adjust, then re-finalize.
export async function reopenTrip(circleId: string, tripId: string, userId: string) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")
  workflowGuard(trip, ["CLOSED"], "reopen")
  const updated = await prisma.travelTrip.update({ where: { id: tripId }, data: { status: "COMPLETED", closedAt: null, finalizedAt: null } })
  await createAuditLog({ userId, circleId, action: "TRAVEL_REOPENED", entityType: "TravelTrip", entityId: tripId, oldValues: { status: "CLOSED" }, newValues: { status: "COMPLETED" }, reason: "Audited correction/reopen of finalized trip" })
  return updated
}

export async function getMyFinalStatement(circleId: string, tripId: string, userId: string) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")
  const snapshot = await prisma.travelStatementSnapshot.findUnique({ where: { tripId_userId: { tripId, userId } } })
  if (snapshot) return { trip: { name: trip.name, destination: trip.destination, startDate: trip.startDate ? trip.startDate.toISOString() : null, endDate: trip.endDate ? trip.endDate.toISOString() : null }, statement: { ...(snapshot.data as any), name: snapshot.name, finalized: true } }
  const review = await getCloseReview(circleId, tripId, userId)
  return { trip: { name: trip.name, destination: trip.destination, startDate: trip.startDate ? trip.startDate.toISOString() : null, endDate: trip.endDate ? trip.endDate.toISOString() : null }, statement: review.my ? { ...review.my, finalized: false } : null }
}