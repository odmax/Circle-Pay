import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createInvestorAgreement, transitionAgreement, updateAgreementTerms, getProjectAgreements } from "@/lib/services/project-investor.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  return NextResponse.json(await getProjectAgreements(projectId))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "create"

  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    if (action === "create") return NextResponse.json(await createInvestorAgreement(projectId, body.participantId, body), { status: 201 })
    if (action === "transition") return NextResponse.json(await transitionAgreement(body.agreementId, body.status, s.user.id))
    if (action === "update") return NextResponse.json(await updateAgreementTerms(body.agreementId, s.user.id, body))

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
