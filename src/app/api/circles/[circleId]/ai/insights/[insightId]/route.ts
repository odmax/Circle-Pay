import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; insightId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { circleId, insightId } = await params
  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }

  const validStatuses = ["ACTIVE", "READ", "ARCHIVED", "RESOLVED"]
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const hasAI = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.AI_VIEW })
  if (!hasAI) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const insight = await prisma.aIInsight.findUnique({ where: { id: insightId } })
  if (!insight || insight.circleId !== circleId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.aIInsight.update({
    where: { id: insightId },
    data: {
      status: status as any,
      isRead: status === "READ" ? true : insight.isRead,
      resolvedAt: status === "RESOLVED" ? new Date() : insight.resolvedAt,
    },
  })

  await createAuditLog({
    userId: session.user.id,
    circleId,
    action: "INSIGHT_STATUS_CHANGED",
    entityType: "AIInsight",
    entityId: insightId,
    oldValues: { status: insight.status, isRead: insight.isRead },
    newValues: { status, isRead: updated.isRead },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; insightId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { circleId, insightId } = await params

  const hasManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.AI_MANAGE })
  if (!hasManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const insight = await prisma.aIInsight.findUnique({ where: { id: insightId } })
  if (!insight || insight.circleId !== circleId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.aIInsight.delete({ where: { id: insightId } })
  await createAuditLog({
    userId: session.user.id,
    circleId,
    action: "INSIGHT_DELETED",
    entityType: "AIInsight",
    entityId: insightId,
  })

  return NextResponse.json({ success: true })
}