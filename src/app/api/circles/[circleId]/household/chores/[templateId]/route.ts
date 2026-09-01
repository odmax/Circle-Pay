import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { updateChoreTemplate } from "@/lib/services/household-chores.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; templateId: string }> }) {
  try {
    const { circleId, templateId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await updateChoreTemplate(circleId, templateId, ctx.userId, await req.json().catch(() => ({}))))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}