import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { updateSharedPurchase, deleteSharedPurchase } from "@/lib/services/household-purchase.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; purchaseId: string }> }) {
  try {
    const { circleId, purchaseId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    return NextResponse.json(await updateSharedPurchase(circleId, purchaseId, ctx.userId, ctx.isManager, await req.json().catch(() => ({}))))
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("paid for") ? 403 : 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ circleId: string; purchaseId: string }> }) {
  try {
    const { circleId, purchaseId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const result = await deleteSharedPurchase(circleId, purchaseId, ctx.userId, ctx.isManager)
    return NextResponse.json(result)
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("paid for") ? 403 : 400 })
  }
}