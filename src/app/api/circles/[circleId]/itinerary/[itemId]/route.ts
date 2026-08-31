import { NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { updateItineraryItem, cancelItineraryItem, assignItineraryMembers, recordBookingPayment } from "@/lib/services/travel-itinerary.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; itemId: string }> }) {
  try {
    const { circleId, itemId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await updateItineraryItem(circleId, itemId, ctx.userId, body))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; itemId: string }> }) {
  const { circleId, itemId } = await params
  const ctx = await getTravelCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "status"
  const body = await req.json().catch(() => ({}))

  try {
    if (action === "cancel") return NextResponse.json(await cancelItineraryItem(circleId, itemId, ctx.userId))
    if (action === "assign") {
      const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : []
      return NextResponse.json(await assignItineraryMembers(circleId, itemId, ctx.userId, userIds))
    }
    if (action === "payment") {
      if (!body.bookingId || !body.status) return NextResponse.json({ error: "bookingId and status are required" }, { status: 400 })
      return NextResponse.json(await recordBookingPayment(circleId, body.bookingId, ctx.userId, body.status))
    }
    // default: status transition
    if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 })
    return NextResponse.json(await updateItineraryItem(circleId, itemId, ctx.userId, { status: body.status }))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}