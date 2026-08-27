import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { prisma } from "@/lib/prisma"
import { proposeAmendment } from "@/lib/services/constitution.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const canView = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CONSTITUTION_VIEW })
    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const amendments = await prisma.constitutionAmendment.findMany({
      where: { circleId },
      orderBy: { createdAt: "desc" },
      include: { proposer: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json(amendments)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const body = await req.json()
    const amendment = await proposeAmendment({
      circleId,
      userId: session.user.id,
      versionId: body.versionId,
      clauseKey: body.clauseKey,
      clauseTitle: body.clauseTitle,
      oldValue: body.oldValue,
      newValue: body.newValue,
      reason: body.reason,
    })
    return NextResponse.json(amendment, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
