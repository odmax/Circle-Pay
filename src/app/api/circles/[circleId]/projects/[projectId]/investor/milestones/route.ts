import { NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { listMilestones, createMilestone } from "@/lib/services/investor-relations.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json({ milestones: await listMilestones(projectId) })
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  try {
    const { circleId, projectId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_MILESTONE_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    const m = await createMilestone(projectId, circleId, ctx.userId, body)
    return NextResponse.json(m, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}