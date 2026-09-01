import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { decideChoreSwap } from "@/lib/services/household-chores.service"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; swapId: string }> }) {
  try {
    const { circleId, swapId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "approve"
    const approve = action === "approve"
    if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    return NextResponse.json(await decideChoreSwap(circleId, swapId, ctx.userId, ctx.isManager, approve))
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own") || message.includes("receiving") ? 403 : 400 })
  }
}