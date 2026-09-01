/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const BOOKING_TYPES = ["FLIGHT", "HOTEL", "TRANSPORT", "ACTIVITY"]
const BOOKABLE = new Set(BOOKING_TYPES)

// ─── Read ───────────────────────────────────────────────────

export interface ItineraryItemView {
  id: string
  type: string
  title: string
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  description: string | null
  bookingReference: string | null
  cost: number | null
  paidByName: string | null
  status: string
  notes: string | null
  assigned: Array<{ userId: string; name: string | null }>
  booking: {
    id: string
    provider: string | null
    reference: string | null
    bookingDate: string | null
    amount: number | null
    currency: string
    paymentStatus: string
    cancellationNotes: string | null
    documents: Array<{ id: string; name: string; url: string; size: number | null }>
  } | null
  documentCount: number
}

export async function getItinerary(circleId: string, tripId: string, viewerUserId: string, isManager: boolean) {
  const items = await prisma.travelItineraryItem.findMany({
    where: { tripId, circleId },
    include: {
      paidBy: { select: { name: true } },
      assigned: { include: { user: { select: { name: true } } } },
      booking: { include: { documents: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })

  const rows: ItineraryItemView[] = items.map((it) => {
    const assignedIds = it.assigned.map((a) => a.userId)
    const canSeeDocs = isManager || assignedIds.includes(viewerUserId)
    const docs = it.booking?.documents ?? []
    return {
      id: it.id,
      type: it.type,
      title: it.title,
      date: it.date ? it.date.toISOString() : null,
      startTime: it.startTime,
      endTime: it.endTime,
      location: it.location,
      description: it.description,
      bookingReference: it.bookingReference,
      cost: it.cost != null ? asNum(it.cost) : null,
      paidByName: it.paidBy?.name ?? null,
      status: it.status,
      notes: it.notes,
      assigned: it.assigned.map((a) => ({ userId: a.userId, name: a.user?.name ?? null })),
      booking: it.booking ? {
        id: it.booking.id,
        provider: it.booking.provider,
        reference: it.booking.reference,
        bookingDate: it.booking.bookingDate ? it.booking.bookingDate.toISOString() : null,
        amount: it.booking.amount != null ? asNum(it.booking.amount) : null,
        currency: it.booking.currency,
        paymentStatus: it.booking.paymentStatus,
        cancellationNotes: it.booking.cancellationNotes,
        documents: canSeeDocs ? docs.map((d) => ({ id: d.id, name: d.name, url: d.url, size: d.size ?? 0 })) : [],
      } : null,
      documentCount: docs.length,
      updatedAt: it.updatedAt.toISOString(),
    }
  })

  const mine = rows.filter((r) => r.assigned.some((a) => a.userId === viewerUserId) || r.paidByName !== null)
  const myBookings = mine.filter((r) => !!r.booking && r.documentCount > 0 ? true : (r.booking && BOOKABLE.has(r.type)))

  return { items: rows, myBookings, mine }
}

export interface ItineraryDashboardSummary {
  todayOrNext: ItineraryItemView | null
  nextFlight: ItineraryItemView | null
  hotel: ItineraryItemView | null
  nextActivity: ItineraryItemView | null
  bookingCompletionPct: number
  missingBookings: ItineraryItemView[]
  missingDocuments: ItineraryItemView[]
}

export async function getItineraryDashboardSummary(circleId: string, tripId: string): Promise<ItineraryDashboardSummary> {
  const { items } = await getItinerary(circleId, tripId, "summary", true)
  const upcoming = items.filter((i) => i.status !== "CANCELLED" && i.status !== "COMPLETED")
  const now = Date.now()
  const day = 86400000

  const todayOrNext = upcoming.find((i) => {
    if (!i.date) return false
    const d = new Date(i.date).getTime()
    return d <= now + day && d + day >= now - day
  }) ?? upcoming[0] ?? null
  const nextFlight = upcoming.find((i) => i.type === "FLIGHT") ?? null
  const hotel = upcoming.find((i) => i.type === "HOTEL") ?? null
  const nextActivity = upcoming.find((i) => i.type === "ACTIVITY") ?? null

  const bookables = items.filter((i) => BOOKABLE.has(i.type) && i.status !== "CANCELLED")
  const booked = bookables.filter((i) => i.status === "BOOKED" || i.status === "CONFIRMED")
  const bookingCompletionPct = bookables.length > 0 ? Math.round((booked.length / bookables.length) * 100) : 0
  const missingBookings = bookables.filter((i) => !i.bookingReference && !i.booking)
  const missingDocuments = bookables.filter((i) => i.status !== "CANCELLED" && !(i.booking && i.documentCount > 0))

  return { todayOrNext, nextFlight, hotel, nextActivity, bookingCompletionPct, missingBookings, missingDocuments }
}

// ─── Notifications (assigned members only, deduped) ─────────

async function notifyAssigned(circleId: string, itemId: string, type: any, title: string, message: string, link: string) {
  const item = await prisma.travelItineraryItem.findUnique({ where: { id: itemId }, include: { assigned: { select: { userId: true } } } })
  if (!item || item.assigned.length === 0) return
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(item.assigned.map((a) => ({ userId: a.userId, circleId, type, title, message, link }))).catch(() => {})
}

// ─── Write (organizer-gated by the route) ───────────────────

export async function createItineraryItem(circleId: string, tripId: string, userId: string, data: any) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, circleId } })
  if (!trip) throw new Error("Trip not found")

  const assignedUserIds: string[] = Array.isArray(data.assignedUserIds) ? data.assignedUserIds as string[] : []
  const item = await prisma.travelItineraryItem.create({
    data: {
      circleId, tripId, createdById: userId,
      type: (data.type || "CUSTOM") as any,
      title: data.title || "Itinerary item",
      date: data.date ? new Date(data.date) : null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
      bookingReference: data.bookingReference ?? null,
      cost: data.cost != null ? asNum(data.cost) : null,
      paidById: data.paidById ?? null,
      status: (data.status || "PLANNED") as any,
      notes: data.notes ?? null,
      assigned: { create: assignedUserIds.map((uid) => ({ userId: uid })) },
    },
  })

  if (data.booking && BOOKABLE.has(item.type)) {
    await prisma.travelBooking.create({
      data: {
        circleId, tripId, createdById: userId, itineraryItemId: item.id,
        provider: data.booking.provider ?? null,
        reference: data.booking.reference ?? null,
        bookingDate: data.booking.bookingDate ? new Date(data.booking.bookingDate) : null,
        amount: data.booking.amount != null ? asNum(data.booking.amount) : null,
        currency: data.booking.currency || trip.currency || "ZAR",
        paymentStatus: (data.booking.paymentStatus || "UNPAID") as any,
      },
    })
  }

  await createAuditLog({ userId, circleId, action: "TRAVEL_ITINERARY_CREATED", entityType: "TravelItineraryItem", entityId: item.id, newValues: { type: item.type, title: item.title } })
  await notifyAssigned(circleId, item.id, "INVESTOR_MEETING", "Itinerary updated", `"${item.title}" was added to the itinerary.`, `/circles/${circleId}/itinerary`)
  return item
}

export async function updateItineraryItem(circleId: string, itemId: string, userId: string, data: any) {
  const item = await prisma.travelItineraryItem.findFirst({ where: { id: itemId, circleId } })
  if (!item) throw new Error("Not found")
  if (item.status === "CANCELLED" && data.status !== "PLANNED" && data.status !== "BOOKED") throw new Error("Cannot edit a cancelled item")

  const safe: any = {}
  for (const k of ["title", "date", "startTime", "endTime", "location", "description", "bookingReference", "notes", "type"]) {
    if (data[k] !== undefined) safe[k] = k === "date" && data[k] ? new Date(data[k]) : (data[k] === "" ? null : data[k])
  }
  if (data.cost !== undefined) safe.cost = data.cost != null ? asNum(data.cost) : null
  if (data.paidById !== undefined) safe.paidById = data.paidById || null
  if (data.status !== undefined) safe.status = data.status

  const meetingPointChanged = item.type === "MEETING_POINT" && data.location && data.location !== item.location

  if (Array.isArray(data.assignedUserIds)) {
    await prisma.travelItineraryAssignment.deleteMany({ where: { itineraryItemId: itemId } })
    if ((data.assignedUserIds as string[]).length > 0) {
      await prisma.travelItineraryAssignment.createMany({
        data: (data.assignedUserIds as string[]).map((uid) => ({ itineraryItemId: itemId, userId: uid })),
      })
    }
  }

  const updated = await prisma.travelItineraryItem.update({ where: { id: itemId }, data: safe })
  const oldValues: Record<string, unknown> = {}
  for (const k of Object.keys(safe)) oldValues[k] = (item as any)[k]
  await createAuditLog({ userId, circleId, action: "TRAVEL_ITINERARY_UPDATED", entityType: "TravelItineraryItem", entityId: itemId, newValues: safe, oldValues })

  if (data.booking) {
    await upsertBookingForItem(circleId, itemId, userId, item.tripId, item.type, data.booking)
  }

  await notifyAssigned(circleId, itemId, "INVESTOR_MEETING", "Itinerary changed", `"${updated.title}" was updated.`, `/circles/${circleId}/itinerary`)
  if (meetingPointChanged) {
    await notifyAssigned(circleId, itemId, "INVESTOR_MEETING", "Meeting point changed", `The meeting point is now "${data.location}".`, `/circles/${circleId}/itinerary`)
  }
  return updated
}

async function upsertBookingForItem(circleId: string, itemId: string, userId: string, tripId: string, type: string, booking: any) {
  if (!BOOKABLE.has(type)) throw new Error("Bookings are only supported for flights, hotels, transport and activities")
  const existing = await prisma.travelBooking.findUnique({ where: { itineraryItemId: itemId } })
  const patch = {
    provider: booking.provider ?? null,
    reference: booking.reference ?? null,
    bookingDate: booking.bookingDate ? new Date(booking.bookingDate) : undefined,
    amount: booking.amount != null ? asNum(booking.amount) : undefined,
    currency: booking.currency || "ZAR",
    paymentStatus: booking.paymentStatus || "UNPAID",
  }
  if (existing) {
    return prisma.travelBooking.update({ where: { id: existing.id }, data: patch as any })
  }
  return prisma.travelBooking.create({ data: { circleId, tripId, createdById: userId, itineraryItemId: itemId, ...patch } as any })
}

export async function cancelItineraryItem(circleId: string, itemId: string, userId: string) {
  const item = await prisma.travelItineraryItem.findFirst({ where: { id: itemId, circleId } })
  if (!item) throw new Error("Not found")
  if (item.status === "COMPLETED") throw new Error("Cannot cancel a completed item")
  const updated = await prisma.travelItineraryItem.update({ where: { id: itemId }, data: { status: "CANCELLED" } })
  await createAuditLog({ userId, circleId, action: "TRAVEL_ITINERARY_CANCELLED", entityType: "TravelItineraryItem", entityId: itemId })
  await notifyAssigned(circleId, itemId, "INVESTOR_MEETING", "Booking cancelled", `"${item.title}" was cancelled.`, `/circles/${circleId}/itinerary`)
  return updated
}

export async function assignItineraryMembers(circleId: string, itemId: string, userId: string, userIds: string[]) {
  const item = await prisma.travelItineraryItem.findFirst({ where: { id: itemId, circleId } })
  if (!item) throw new Error("Not found")
  await prisma.travelItineraryAssignment.deleteMany({ where: { itineraryItemId: itemId } })
  if (userIds.length > 0) {
    await prisma.travelItineraryAssignment.createMany({ data: userIds.map((uid) => ({ itineraryItemId: itemId, userId: uid })) })
  }
  await createAuditLog({ userId, circleId, action: "TRAVEL_ITINERARY_ASSIGNED", entityType: "TravelItineraryItem", entityId: itemId, newValues: { assigned: userIds } })
  await notifyAssigned(circleId, itemId, "INVESTOR_MEETING", "You were assigned", `You were assigned to "${item.title}".`, `/circles/${circleId}/itinerary`)
  return { ok: true }
}

export async function addBookingDocument(circleId: string, bookingId: string, userId: string, data: { name: string; url: string; mimeType?: string; size?: number }) {
  const booking = await prisma.travelBooking.findFirst({ where: { id: bookingId, circleId } })
  if (!booking) throw new Error("Not found")
  const doc = await prisma.travelBookingDocument.create({
    data: { bookingId, uploadedById: userId, name: data.name, url: data.url, mimeType: data.mimeType ?? null, size: data.size ?? null },
  })
  await createAuditLog({ userId, circleId, action: "TRAVEL_BOOKING_DOCUMENT", entityType: "TravelBookingDocument", entityId: doc.id, newValues: { name: data.name } })
  if (booking.itineraryItemId) {
    await notifyAssigned(circleId, booking.itineraryItemId, "INVESTOR_MEETING", "Document uploaded", `A booking document "${data.name}" was uploaded.`, `/circles/${circleId}/itinerary`)
  }
  return doc
}

// Payment records reuse the existing circle expense ledger, idempotently.
export async function recordBookingPayment(circleId: string, bookingId: string, userId: string, status: string) {
  const booking = await prisma.travelBooking.findFirst({ where: { id: bookingId, circleId } })
  if (!booking) throw new Error("Not found")
  const item = booking.itineraryItemId
    ? await prisma.travelItineraryItem.findUnique({ where: { id: booking.itineraryItemId }, include: { paidBy: { select: { id: true, name: true } } } })
    : null
  const allowed = ["PENDING", "UNPAID", "PARTIAL", "PAID", "REFUNDED"]
  if (!allowed.includes(status)) throw new Error("Invalid payment status")

  if (status === "PAID" && !(booking.metadata as any)?.ledgerExpenseId) {
    const paidById = item?.paidBy?.id ?? item?.createdById ?? userId
    try {
      const { createExpense } = await import("@/lib/services/expense.service")
      const expense = await createExpense(circleId, userId, {
        title: `Trip booking: ${item?.title || "Booking"}`,
        notes: booking.reference || booking.provider || undefined,
        amount: booking.amount != null ? asNum(booking.amount) : 0,
        category: (item?.type || "transport").toLowerCase(),
        splitType: "EQUAL",
        expenseDate: new Date().toISOString(),
        paidById,
        splits: [{ userId: paidById }],
      })
      await prisma.travelBooking.update({
        where: { id: bookingId },
        data: { paymentStatus: "PAID", paidAt: new Date(), metadata: { ...(booking.metadata as any || {}), ledgerExpenseId: expense.id } },
      })
      if (booking.itineraryItemId) {
        await notifyAssigned(circleId, booking.itineraryItemId, "INVESTOR_MEETING", "Booking confirmed & paid", `"${item?.title}" payment was recorded.`, `/circles/${circleId}/itinerary`)
      }
      return { ...booking, paymentStatus: "PAID", expenseId: expense.id }
    } catch (e) {
      throw new Error(`Could not record payment into the ledger: ${(e as Error).message}`)
    }
  }

  const updated = await prisma.travelBooking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: status as any,
      paidAt: status === "PAID" ? new Date() : status === "REFUNDED" ? null : undefined,
      cancellationNotes: status === "REFUNDED" ? (booking.cancellationNotes || "Refunded") : undefined,
    },
  })
  await createAuditLog({ userId, circleId, action: "TRAVEL_BOOKING_PAYMENT", entityType: "TravelBooking", entityId: bookingId, newValues: { paymentStatus: status } })
  return updated
}

// Reminder sweep: approaching itinerary items within 24h (assigned members only).
export async function sweepTravelItineraryReminders(circleId: string) {
  const trip = await prisma.travelTrip.findUnique({ where: { circleId } })
  if (!trip) return []
  const soon = new Date(Date.now() + 24 * 3600000)
  const items = await prisma.travelItineraryItem.findMany({
    where: { tripId: trip.id, circleId, status: { notIn: ["CANCELLED", "COMPLETED"] }, date: { lte: soon } },
    include: { assigned: { select: { userId: true } } },
  })
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  const notified: string[] = []
  for (const it of items) {
    if ((it.metadata as any)?.notifiedApproaching === true) continue
    if (it.assigned.length === 0) continue
    await createBulkNotifications(
      it.assigned.map((a) => ({
        userId: a.userId, circleId, type: "INVESTOR_MEETING", title: `Upcoming: ${it.title}`,
        message: `Itinerary item "${it.title}" is coming up${it.startTime ? ` at ${it.startTime}` : ""}.`,
        link: `/circles/${circleId}/itinerary`,
      })),
    ).catch(() => {})
    await prisma.travelItineraryItem.update({ where: { id: it.id }, data: { metadata: { ...(it.metadata as any || {}), notifiedApproaching: true } } })
    notified.push(it.id)
  }
  return notified
}