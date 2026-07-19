import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission, getCircleMemberPermissions } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getApprovalTimeline, cancelRequest } from "@/lib/services/approval.service"
import { getRequestStageProgress } from "@/lib/services/approval-workflow-engine.service"
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
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        decisions: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!approval || approval.circleId !== circleId) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 })
    }

    const timeline = await getApprovalTimeline(approvalId)
    const stages = approval.workflowSnapshot ? await getRequestStageProgress(approvalId) : null

    return NextResponse.json({
      ...approval,
      amount: approval.amount ? Number(approval.amount) : null,
      isExpired: approval.expiresAt ? new Date() > approval.expiresAt : false,
      approvalsNeeded: approval.minimumApprovals - approval.currentApprovals,
      timeline: timeline.events,
      stages,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch approval request"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, approvalId } = await params
    const body = await req.json()
    const { action } = body as { action?: string }

    if (action !== "cancel") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: { id: true, circleId: true, requestedById: true },
    })
    if (!approval || approval.circleId !== circleId) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 })
    }

    const isRequester = approval.requestedById === session.user.id
    if (!isRequester) {
      const perms = await getCircleMemberPermissions({
        userId: session.user.id,
        circleId,
      })
      const isOwner = perms?.role === "OWNER"
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the requester or circle owner can cancel" },
          { status: 403 }
        )
      }
    }

    const updated = await cancelRequest({
      approvalRequestId: approvalId,
      userId: session.user.id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to cancel approval request"
    const status = msg.includes("not found") ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
