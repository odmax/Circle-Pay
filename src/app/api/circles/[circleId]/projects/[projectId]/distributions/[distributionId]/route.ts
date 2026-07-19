import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateProjectOwnership, createProfitDistribution, approveProfitDistribution, markDistributionPaid, cancelDistribution, getProjectDistributionDashboard } from "@/lib/services/project-distribution.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; distributionId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, distributionId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  try {
    if (action === "ownership") return NextResponse.json(await calculateProjectOwnership(projectId))
    if (action === "get") return NextResponse.json(await getProjectDistributionDashboard(projectId))
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (action === "create") return NextResponse.json(await createProfitDistribution(projectId, circleId, s.user.id, await req.json()), { status: 201 })
    if (!distributionId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    if (action === "approve") return NextResponse.json(await approveProfitDistribution(distributionId, s.user.id))
    if (action === "paid") return NextResponse.json(await markDistributionPaid(distributionId, s.user.id))
    if (action === "cancel") return NextResponse.json(await cancelDistribution(distributionId, s.user.id))
    return NextResponse.json({ error: "Unknown" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}
export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, new URL(req.url).pathname.includes("/ownership") ? "ownership" : "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; distributionId?: string }> }) => handle(req, ctx, new URL(req.url).pathname.endsWith("/approve") ? "approve" : new URL(req.url).pathname.endsWith("/paid") ? "paid" : new URL(req.url).pathname.endsWith("/cancel") ? "cancel" : "create")
