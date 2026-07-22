import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { proposeOwnershipSnapshot, approveOwnershipSnapshot, rejectOwnershipSnapshot, getEffectiveOwnership, getOwnershipHistory, adjustOwnershipEntry } from "@/lib/services/project-ownership.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(req.url)
  const view = url.searchParams.get("view") || "effective"

  if (view === "effective") return NextResponse.json(await getEffectiveOwnership(projectId))
  if (view === "history") return NextResponse.json(await getOwnershipHistory(projectId))

  return NextResponse.json(await getEffectiveOwnership(projectId))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "propose"

  try {
    if (action === "propose") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OWNERSHIP_MANAGE })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const body = await req.json()
      return NextResponse.json(await proposeOwnershipSnapshot(projectId, s.user.id, body), { status: 201 })
    }

    if (action === "approve") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OWNERSHIP_MANAGE })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const body = await req.json()
      return NextResponse.json(await approveOwnershipSnapshot(body.snapshotId, s.user.id))
    }

    if (action === "reject") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OWNERSHIP_MANAGE })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const body = await req.json()
      return NextResponse.json(await rejectOwnershipSnapshot(body.snapshotId, s.user.id, body.reason))
    }

    if (action === "adjust") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OWNERSHIP_MANAGE })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const body = await req.json()
      return NextResponse.json(await adjustOwnershipEntry(body.snapshotId, body.participantId, s.user.id, body))
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
