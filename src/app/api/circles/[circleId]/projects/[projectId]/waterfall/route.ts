import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getWaterfallConfig, upsertWaterfallConfig, createWaterfallDistribution } from "@/lib/services/project-waterfall.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  const config = await getWaterfallConfig(projectId)
  return NextResponse.json({ config })
}

export async function PUT(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.DISTRIBUTION_CREATE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await upsertWaterfallConfig(projectId, s.user.id, await req.json()))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.DISTRIBUTION_CREATE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await createWaterfallDistribution(projectId, circleId, s.user.id, body), { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
