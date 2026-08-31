import { NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { getItinerary, getItineraryDashboardSummary, createItineraryItem } from "@/lib/services/travel-itinerary.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getTravelCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const data = await getItinerary(circleId, ctx.tripId, ctx.userId, ctx.isManager)
  const summary = await getItineraryDashboardSummary(circleId, ctx.tripId)
  return NextResponse.json({ items: data.items, myBookings: data.myBookings, mine: data.mine, summary, isManager: ctx.isManager })
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await createItineraryItem(circleId, ctx.tripId, ctx.userId, body), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}