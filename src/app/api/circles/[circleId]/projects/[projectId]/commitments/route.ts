import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCommitment, approveCommitment, cancelCommitment } from "@/lib/services/project-funding.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "create"

  try {
    if (action === "create") {
      const body = await req.json()
      // Find or create participant for this user
      let participant = await prisma.projectParticipant.findFirst({ where: { projectId, userId: s.user.id } })
      if (!participant) {
        participant = await prisma.projectParticipant.create({ data: { projectId, userId: s.user.id, circleMemberId: member.id, type: "CIRCLE_MEMBER", status: "ACCEPTED", joinedAt: new Date() } })
      }
      return NextResponse.json(await createCommitment(body.fundingRoundId, participant.id, body), { status: 201 })
    }

    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    if (action === "approve") return NextResponse.json(await approveCommitment(body.commitmentId, s.user.id))
    if (action === "cancel") return NextResponse.json(await cancelCommitment(body.commitmentId, s.user.id, body.reason))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
