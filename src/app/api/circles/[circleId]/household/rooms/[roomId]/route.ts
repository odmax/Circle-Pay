import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { updateHouseholdRoom, deleteHouseholdRoom } from "@/lib/services/household-lease.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; roomId: string }> }) {
  try {
    const { circleId, roomId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await updateHouseholdRoom(circleId, roomId, ctx.userId, await req.json().catch(() => ({}))))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ circleId: string; roomId: string }> }) {
  try {
    const { circleId, roomId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await deleteHouseholdRoom(circleId, roomId, ctx.userId))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}