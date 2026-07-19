import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getApprovalTimeline } from "@/lib/services/approval.service"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, approvalId } = await params
    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: { id: true, circleId: true },
    })
    if (!approval || approval.circleId !== circleId) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 })
    }

    const timeline = await getApprovalTimeline(approvalId)

    return NextResponse.json(timeline)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch timeline"
    const status = msg.includes("not found") ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
