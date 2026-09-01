import { NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { getCloseReview, startTripReconciliation, startTripSettlementPhase, finalizeTrip, reopenTrip } from "@/lib/services/travel-close.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getTravelCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const review = await getCloseReview(circleId, ctx.tripId, ctx.userId)
  return NextResponse.json({ ...review, isManager: ctx.isManager })
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "reconcile"
    const body = await req.json().catch(() => ({}))

    if (action === "reconcile") return NextResponse.json(await startTripReconciliation(circleId, ctx.tripId, ctx.userId))
    if (action === "settle") return NextResponse.json(await startTripSettlementPhase(circleId, ctx.tripId, ctx.userId))
    if (action === "finalize") return NextResponse.json(await finalizeTrip(circleId, ctx.tripId, ctx.userId, !!body.force))
    if (action === "reopen") return NextResponse.json(await reopenTrip(circleId, ctx.tripId, ctx.userId))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}