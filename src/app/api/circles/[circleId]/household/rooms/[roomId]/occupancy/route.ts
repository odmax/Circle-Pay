import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { assignRoomOccupancy, clearRoomOccupant } from "@/lib/services/household-lease.service"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; roomId: string }> }) {
  try {
    const { circleId, roomId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "assign"
    const body = await req.json().catch(() => ({}))

    if (action === "assign") {
      if (!body.memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 })
      return NextResponse.json(await assignRoomOccupancy(circleId, roomId, ctx.userId, body.memberId, { moveIn: body.moveIn, moveOut: body.moveOut }), { status: 201 })
    }
    if (action === "clear") {
      if (!body.memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 })
      return NextResponse.json(await clearRoomOccupant(circleId, roomId, ctx.userId, body.memberId))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}