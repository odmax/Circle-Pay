import { NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { updateMilestone, transitionMilestone } from "@/lib/services/investor-relations.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; milestoneId: string }> }) {
  try {
    const { circleId, projectId, milestoneId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_MILESTONE_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await updateMilestone(projectId, milestoneId, circleId, ctx.userId, body))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

const VALID_TRANSITIONS = ["PLANNED", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED", "CANCELLED"]

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; milestoneId: string }> }) {
  try {
    const { circleId, projectId, milestoneId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_MILESTONE_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    const status = body.status || body.action
    if (!VALID_TRANSITIONS.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    return NextResponse.json(await transitionMilestone(projectId, milestoneId, circleId, ctx.userId, status))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}