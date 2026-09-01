/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const TRAVEL_DOC_TYPES = [
  "PASSPORT", "VISA", "FLIGHT_TICKET", "HOTEL_CONFIRMATION",
  "TRAVEL_INSURANCE", "BOOKING_CONFIRMATION", "VACCINATION_HEALTH", "OTHER",
]
const REQUIRED_TYPES = ["PASSPORT", "TRAVEL_INSURANCE"]

export function computeDocumentAlerts(docs: Array<{ type: string; expiryDate: Date | null }>, requireAll: boolean) {
  const missing = requireAll ? REQUIRED_TYPES.filter((t) => !docs.some((d) => d.type === t)) : []
  const expiring = docs
    .filter((d) => d.expiryDate && (d.type === "PASSPORT" || d.type === "VISA"))
    .map((d) => ({ type: d.type, expiryDate: d.expiryDate as Date, days: Math.round(((d.expiryDate as Date).getTime() - Date.now()) / 86400000) }))
    .filter((d) => d.days >= 0 && d.days <= 60)
    .sort((a, b) => a.days - b.days)
  return { missing, expiring, hasPassportOrVisa: docs.some((d) => d.type === "PASSPORT" || d.type === "VISA") }
}

export async function listTravelDocuments(circleId: string, tripId: string, viewerUserId: string, isManager: boolean) {
  const [trip, myDocs, allDocs, members] = await Promise.all([
    prisma.travelTrip.findFirst({ where: { id: tripId, circleId } }),
    prisma.travelDocument.findMany({ where: { tripId, circleId, ownerUserId: viewerUserId }, orderBy: { createdAt: "desc" } }),
    isManager ? prisma.travelDocument.findMany({ where: { tripId, circleId } }) : Promise.resolve([]),
    prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { name: true } } } }),
  ])
  const requireAll = !!trip && ["ACTIVE", "CONFIRMED"].includes(trip.status)

  const mine = myDocs.map((d) => ({
    id: d.id,
    type: d.type,
    name: d.name,
    url: d.url,
    expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
    relatedItemId: d.relatedItemId,
    notes: d.notes,
    createdAt: d.createdAt.toISOString(),
  }))
  const myAlerts = computeDocumentAlerts(myDocs, requireAll)

  // Managers get per-member oversight: counts + missing/expiring only (never private URLs).
  const memberDocCounts = members.map((m) => {
    const docs = allDocs.filter((d) => d.ownerUserId === m.userId)
    const alerts = computeDocumentAlerts(docs, requireAll)
    return {
      userId: m.userId,
      name: m.user?.name ?? m.userId,
      count: docs.length,
      missing: alerts.missing,
      expiringTypes: alerts.expiring.map((e) => e.type),
    }
  })

  return { myDocuments: mine, myAlerts, memberDocCounts, docTypes: TRAVEL_DOC_TYPES }
}

export async function addTravelDocument(circleId: string, tripId: string, actorUserId: string, data: {
  ownerUserId?: string
  type: string
  name?: string
  url: string
  mimeType?: string
  size?: number
  expiryDate?: string | null
  relatedItemId?: string | null
  notes?: string | null
}) {
  const ownerUserId = data.ownerUserId || actorUserId
  const doc = await prisma.travelDocument.create({
    data: {
      circleId, tripId, ownerUserId, createdById: actorUserId,
      type: (data.type || "OTHER") as any,
      name: data.name || null,
      url: data.url,
      mimeType: data.mimeType ?? null,
      size: data.size ?? null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      relatedItemId: data.relatedItemId ?? null,
      notes: data.notes ?? null,
    },
  })
  await createAuditLog({ userId: actorUserId, circleId, action: "TRAVEL_DOCUMENT_ADDED", entityType: "TravelDocument", entityId: doc.id, newValues: { type: doc.type, ownerUserId } })
  return doc
}

export async function updateTravelDocument(circleId: string, docId: string, actorUserId: string, data: Record<string, unknown>) {
  const doc = await prisma.travelDocument.findFirst({ where: { id: docId, circleId } })
  if (!doc) throw new Error("Not found")
  const safe: any = {}
  for (const k of ["type", "name", "notes", "expiryDate", "relatedItemId"]) if (data[k] !== undefined) safe[k] = data[k]
  if (safe.expiryDate === "" || safe.expiryDate === null) safe.expiryDate = null
  if (safe.expiryDate) safe.expiryDate = new Date(safe.expiryDate)
  const updated = await prisma.travelDocument.update({ where: { id: docId }, data: safe })
  await createAuditLog({ userId: actorUserId, circleId, action: "TRAVEL_DOCUMENT_UPDATED", entityType: "TravelDocument", entityId: docId, newValues: safe, oldValues: { type: doc.type, notes: doc.notes } })
  return updated
}

export async function deleteTravelDocument(circleId: string, docId: string, actorUserId: string, isManager: boolean) {
  const doc = await prisma.travelDocument.findFirst({ where: { id: docId, circleId } })
  if (!doc) throw new Error("Not found")
  if (!isManager && doc.ownerUserId !== actorUserId && doc.createdById !== actorUserId) throw new Error("You can only delete your own documents")
  await prisma.travelDocument.delete({ where: { id: docId } })
  await createAuditLog({ userId: actorUserId, circleId, action: "TRAVEL_DOCUMENT_DELETED", entityType: "TravelDocument", entityId: docId })
  return { ok: true }
}

export async function getTravelDocumentSummary(circleId: string, tripId: string, viewerUserId: string) {
  const [trip, mine] = await Promise.all([
    prisma.travelTrip.findFirst({ where: { id: tripId, circleId } }),
    prisma.travelDocument.findMany({ where: { tripId, circleId, ownerUserId: viewerUserId } }),
  ])
  const requireAll = !!trip && ["ACTIVE", "CONFIRMED"].includes(trip.status)
  const alerts = computeDocumentAlerts(mine, requireAll)
  return { requireAll, docCount: mine.length, missing: alerts.missing, expiring: alerts.expiring.map((e) => ({ type: e.type, days: e.days })) }
}

// Daily alert sweep — notifies only the document owner (private), deduped per day.
export async function sweepTravelDocumentAlerts(circleId: string) {
  const trip = await prisma.travelTrip.findUnique({ where: { circleId } })
  if (!trip) return []
  const flagged = (trip.metadata as any)?.docAlertsNotifiedDate
  const today = new Date().toISOString().slice(0, 10)
  if (flagged === today) return []

  const requireAll = ["ACTIVE", "CONFIRMED"].includes(trip.status)
  if (!requireAll) return []
  const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
  const docs = await prisma.travelDocument.findMany({ where: { tripId: trip.id, circleId } })
  const { createNotification } = await import("@/lib/services/notification.service")
  const notified: string[] = []
  for (const m of members) {
    const mine = docs.filter((d) => d.ownerUserId === m.userId)
    const alerts = computeDocumentAlerts(mine, requireAll)
    for (const type of alerts.missing) {
      await createNotification({ userId: m.userId, circleId, type: "TRAVEL_DOC_MISSING", title: `Missing travel document: ${type.replace(/_/g, " ")}`, message: `Add your ${type.replace(/_/g, " ")} before departure.`, link: `/circles/${circleId}/travel-documents` }).catch(() => {})
      notified.push(`missing:${m.userId}:${type}`)
    }
    for (const e of alerts.expiring) {
      await createNotification({ userId: m.userId, circleId, type: "TRAVEL_DOC_EXPIRING", title: `${e.type.replace(/_/g, " ")} expires soon`, message: `Your ${e.type.replace(/_/g, " ")} expires in ${e.days} day(s).`, link: `/circles/${circleId}/travel-documents` }).catch(() => {})
      notified.push(`expiring:${m.userId}:${e.type}`)
    }
  }
  await prisma.travelTrip.update({ where: { id: trip.id }, data: { metadata: { ...(trip.metadata as any || {}), docAlertsNotifiedDate: today } } })
  return notified
}

// Live "today" context derived from itinerary + bookings.
export async function getTodayContext(circleId: string, tripId: string, viewerUserId: string) {
  const { getItinerary, getItineraryDashboardSummary } = await import("@/lib/services/travel-itinerary.service")
  const [{ items }, summary] = await Promise.all([
    getItinerary(circleId, tripId, viewerUserId, false),
    getItineraryDashboardSummary(circleId, tripId),
  ])
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayItems = items.filter((i) => i.date && i.date.slice(0, 10) === todayKey && i.status !== "CANCELLED")
  const upcoming = items.filter((i) => i.status !== "CANCELLED" && i.status !== "COMPLETED" && !(i.date && i.date.slice(0, 10) === todayKey))
  const nextItem = summary.todayOrNext ?? upcoming[0] ?? null
  const meetingPoint = items.find((i) => i.type === "MEETING_POINT" && i.status !== "CANCELLED") ?? null
  const transport = upcoming.find((i) => i.type === "TRANSPORT") ?? null
  const hotel = summary.hotel
  const upcomingBooking = upcoming.find((i) => i.booking && (i.booking.reference || i.booking.bookingDate)) ?? null
  return {
    todayItems: todayItems.map((i) => ({ id: i.id, title: i.title, type: i.type, startTime: i.startTime, endTime: i.endTime, location: i.location, status: i.status, bookingReference: i.bookingReference })),
    nextItem: nextItem ? { id: nextItem.id, title: nextItem.title, type: nextItem.type, date: nextItem.date, startTime: nextItem.startTime, location: nextItem.location } : null,
    meetingPoint: meetingPoint ? { title: meetingPoint.title, location: meetingPoint.location, startTime: meetingPoint.startTime } : null,
    transport: transport ? { title: transport.title, startTime: transport.startTime, location: transport.location } : null,
    hotel: hotel ? { title: hotel.title } : null,
    upcomingBooking: upcomingBooking ? { title: upcomingBooking.title, type: upcomingBooking.type, date: upcomingBooking.date, bookingReference: upcomingBooking.bookingReference, startTime: upcomingBooking.startTime } : null,
  }
}

export { asNum }