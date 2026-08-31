/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import {
  computeTripCountdown,
  computeTravelBudget,
  computeMyTravelPosition,
  computeTravelAlerts,
  formatTripCurrency,
  type TravelAlert,
} from "@/lib/services/travel-metrics"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface TravelDashboard {
  trip: {
    id: string
    name: string
    destination: string | null
    startDate: string | null
    endDate: string | null
    currency: string
    totalBudget: number
    contributionTarget: number
    status: string
    coverImage: string | null
    meetingPoint: string | null
    emergencyContact: string | null
    notes: string | null
  } | null
  countdown: ReturnType<typeof computeTripCountdown>
  budget: ReturnType<typeof computeTravelBudget>
  my: ReturnType<typeof computeMyTravelPosition>
  deadlines: Array<{ id: string; name: string; amount: number; dueDate: string | null }>
  events: Array<{ id: string; title: string; description: string | null; startAt: string; isOnline: boolean; myRsvp: string | null }>
  polls: Array<{ id: string; title: string; closesAt: string | null; myVoted: boolean }>
  activity: Array<{ id: string; title: string | null; content: string; createdAt: string; authorName: string | null }>
  alerts: TravelAlert[]
  memberCount: number
  membersPaid: number
}

export async function getTravelDashboard(circleId: string, viewerUserId: string): Promise<TravelDashboard> {
  const [trip, paidContribs, myContribs, expenses, mySplits, schedules, events, polls, feeds, memberCount] = await Promise.all([
    prisma.travelTrip.findUnique({ where: { circleId } }),
    prisma.contribution.findMany({ where: { circleId, status: "PAID" } }),
    prisma.contribution.findMany({ where: { circleId, userId: viewerUserId } }),
    prisma.expense.findMany({ where: { circleId, deletedAt: null } }),
    prisma.expenseSplit.findMany({ where: { userId: viewerUserId, expense: { circleId, deletedAt: null } } }),
    prisma.contributionSchedule.findMany({ where: { circleId, isActive: true, deletedAt: null }, orderBy: { nextDueDate: "asc" } }),
    prisma.circleEvent.findMany({
      where: { circleId, deletedAt: null, startAt: { gte: new Date() }, status: { not: "CANCELLED" } },
      include: { rsvps: { where: { userId: viewerUserId }, select: { status: true } } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.circlePoll.findMany({
      where: { circleId, deletedAt: null, status: "OPEN" },
      include: { votes: { where: { userId: viewerUserId }, select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.feedPost.findMany({ where: { circleId, deletedAt: null }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.circleMember.count({ where: { circleId } }),
  ])

  const currency = trip?.currency || "ZAR"
  const collected = paidContribs.reduce((s, c) => s + asNum(c.amount), 0)
  const membersPaid = new Set(paidContribs.map((c) => c.userId)).size
  const spent = expenses.reduce((s, e) => s + asNum(e.amount), 0)

  const myPaid = myContribs.filter((c) => c.status === "PAID").reduce((s, c) => s + asNum(c.amount), 0)
  const myPending = myContribs.filter((c) => c.status === "PENDING").reduce((s, c) => s + asNum(c.amount), 0)
  const myExpenseShare = mySplits.reduce((s, x) => s + asNum(x.amount), 0)

  const countdown = computeTripCountdown(trip?.startDate ?? null, trip?.endDate ?? null, trip?.status ?? "PLANNING")
  const budget = computeTravelBudget({
    collected,
    spent,
    totalBudget: trip ? asNum(trip.totalBudget) : 0,
    contributionTarget: trip ? asNum(trip.contributionTarget) : 0,
    memberCount,
    membersPaid,
  })
  const my = computeMyTravelPosition({
    myPaid,
    myPending,
    contributionTarget: trip ? asNum(trip.contributionTarget) : 0,
    memberCount,
    myExpenseShare,
  })

  const deadlines = schedules.map((s) => ({ id: s.id, name: s.name, amount: asNum(s.amount), dueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null }))
  const openPolls = polls
  const openPollsNotVoted = openPolls.filter((p) => p.votes.length === 0).length
  const myPendingWithoutProof = myContribs.some((c) => c.status === "PENDING" && !c.proofUrl)
  const myPendingWithProof = myContribs.some((c) => (c.status === "PENDING" || c.status === "PROOF_SUBMITTED") && !!c.proofUrl)

  const alerts = computeTravelAlerts({
    countdown,
    budget,
    contributionTarget: trip ? asNum(trip.contributionTarget) : 0,
    deadlines,
    events: events.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt.toISOString() })),
    openPollsNotVoted,
    myPendingWithProof,
    myPendingWithoutProof,
  })

  return {
    trip: trip ? {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate ? trip.startDate.toISOString() : null,
      endDate: trip.endDate ? trip.endDate.toISOString() : null,
      currency,
      totalBudget: asNum(trip.totalBudget),
      contributionTarget: asNum(trip.contributionTarget),
      status: trip.status,
      coverImage: trip.coverImage,
      meetingPoint: trip.meetingPoint,
      emergencyContact: trip.emergencyContact,
      notes: trip.notes,
    } : null,
    countdown,
    budget,
    my,
    deadlines,
    events: events.map((e) => ({ id: e.id, title: e.title, description: e.description, startAt: e.startAt.toISOString(), isOnline: e.isOnline, myRsvp: e.rsvps[0]?.status ?? null })),
    polls: openPolls.map((p) => ({ id: p.id, title: p.title, closesAt: p.closesAt ? p.closesAt.toISOString() : null, myVoted: p.votes.length > 0 })),
    activity: feeds.map((f) => ({ id: f.id, title: f.title, content: f.content, createdAt: f.createdAt.toISOString(), authorName: f.author?.name ?? null })),
    alerts,
    memberCount,
    membersPaid,
  }
}

const TRIP_FIELDS = ["name", "destination", "startDate", "endDate", "currency", "totalBudget", "contributionTarget", "status", "coverImage", "meetingPoint", "emergencyContact", "notes"]

async function sanitizeTripData(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const safe: Record<string, unknown> = {}
  for (const k of TRIP_FIELDS) {
    if (data[k] === undefined) continue
    if (k === "startDate" || k === "endDate") safe[k] = data[k] ? new Date(String(data[k])) : null
    else if (k === "totalBudget" || k === "contributionTarget") safe[k] = data[k] ? asNum(data[k]) : null
    else if (data[k] === null || data[k] === "") safe[k] = null
    else safe[k] = data[k]
  }
  return safe
}

export async function upsertTravelTrip(circleId: string, userId: string, data: Record<string, unknown>) {
  const safe = await sanitizeTripData(data || {})
  if (!safe.name && (await prisma.travelTrip.findUnique({ where: { circleId } }))) safe.name = "Untitled trip"
  if (!safe.name) safe.name = "Untitled trip"
  if (!safe.currency) safe.currency = "ZAR"
  const trip = await prisma.travelTrip.upsert({
    where: { circleId },
    create: { circleId, createdById: userId, ...(safe as any) },
    update: { ...(safe as any), updatedAt: new Date() },
  })
  await createAuditLog({ userId, circleId, action: "TRAVEL_TRIP_UPDATED", entityType: "TravelTrip", entityId: trip.id, newValues: safe })
  return trip
}

export async function updateTravelTripStatus(circleId: string, userId: string, status: string) {
  const allowed = ["PLANNING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"]
  if (!allowed.includes(status)) throw new Error("Invalid trip status")
  const trip = await prisma.travelTrip.update({ where: { circleId }, data: { status: status as any } })
  await createAuditLog({ userId, circleId, action: "TRAVEL_TRIP_STATUS", entityType: "TravelTrip", entityId: trip.id, newValues: { status } })
  return trip
}

// Reuse the notification system to remind outstanding members (no new finance engine).
export async function sendTravelReminders(circleId: string, userId: string) {
  const trip = await prisma.travelTrip.findUnique({ where: { circleId } })
  if (!trip) throw new Error("Trip not configured")
  const paidIds = new Set((await prisma.contribution.findMany({ where: { circleId, status: "PAID" }, select: { userId: true } })).map((c) => c.userId))
  const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
  const outstanding = members.filter((m) => !paidIds.has(m.userId))
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(
    outstanding.map((m) => ({
      userId: m.userId,
      circleId,
      type: "CONTRIBUTION_REMINDER",
      title: `Trip contribution reminder: ${trip.name}`,
      message: "Your trip contribution is outstanding — please settle it before departure.",
      link: `/circles/${circleId}/trip`,
    })),
  ).catch(() => {})
  await createAuditLog({ userId, circleId, action: "TRAVEL_REMINDERS_SENT", entityType: "TravelTrip", entityId: trip.id, newValues: { count: outstanding.length } })
  return { count: outstanding.length }
}

export { formatTripCurrency }