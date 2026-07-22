import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createDistributionPeriod, closeDistributionPeriod, getProjectDistributionPeriods } from "@/lib/services/project-financial-statement.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  return NextResponse.json(await getProjectDistributionPeriods(projectId))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.DISTRIBUTION_CREATE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await createDistributionPeriod(projectId, circleId, s.user.id, body), { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.DISTRIBUTION_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { periodId } = await req.json()
    return NextResponse.json(await closeDistributionPeriod(periodId, s.user.id))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
