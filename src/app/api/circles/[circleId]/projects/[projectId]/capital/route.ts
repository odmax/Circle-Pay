import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recordCapitalTransaction, confirmCapitalTransaction, rejectCapitalTransaction, getProjectCapitalTransactions } from "@/lib/services/project-capital.service"
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
  const classification = url.searchParams.get("classification") || undefined
  const status = url.searchParams.get("status") || undefined
  return NextResponse.json(await getProjectCapitalTransactions(projectId, { classification: classification || undefined, status: status || undefined }))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "record"

  try {
    const body = await req.json()

    if (action === "record") {
      // Find or create participant for this user
      let participant = await prisma.projectParticipant.findFirst({ where: { projectId, userId: s.user.id } })
      if (!participant) {
        participant = await prisma.projectParticipant.create({ data: { projectId, userId: s.user.id, circleMemberId: member.id, type: "CIRCLE_MEMBER", status: "ACCEPTED", joinedAt: new Date() } })
      }
      return NextResponse.json(await recordCapitalTransaction(projectId, participant.id, body), { status: 201 })
    }

    if (action === "confirm") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.FUNDING_RECORD })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return NextResponse.json(await confirmCapitalTransaction(body.txId, s.user.id))
    }

    if (action === "reject") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.FUNDING_RECORD })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return NextResponse.json(await rejectCapitalTransaction(body.txId, s.user.id, body.reason))
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
