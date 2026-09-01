import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { createGroceryRun } from "@/lib/services/household-purchase.service"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const body = await req.json()
    if (body.assignedShopperId && body.assignedShopperId !== ctx.userId && !ctx.isManager) {
      return NextResponse.json({ error: "Only managers can assign a different shopper" }, { status: 403 })
    }
    return NextResponse.json(await createGroceryRun(circleId, ctx.userId, ctx.isManager, body), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}