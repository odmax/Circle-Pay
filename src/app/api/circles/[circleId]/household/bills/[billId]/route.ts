import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { updateRecurringBill } from "@/lib/services/household-bills.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; billId: string }> }) {
  try {
    const { circleId, billId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await updateRecurringBill(circleId, billId, ctx.userId, await req.json().catch(() => ({}))))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; billId: string }> }) {
  try {
    const { circleId, billId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "pause"
    if (action === "pause" || action === "resume") {
      return NextResponse.json(await updateRecurringBill(circleId, billId, ctx.userId, { active: action === "resume" }))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}