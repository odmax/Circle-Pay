import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getApprovalTimeline } from "@/lib/services/approval.service"
import { getRequestStageProgress, getCurrentStage } from "@/lib/services/approval-workflow-engine.service"
import { prisma } from "@/lib/prisma"
import { toApprovalDetail, toRuntimeStage } from "@/lib/api/dtos"
import { apiSuccess, apiError, mapServiceError } from "@/lib/api/errors"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", "Authentication required")
  }

  try {
    const { circleId, approvalId } = await params

    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
    })
    if (!canView) {
      return apiError("FORBIDDEN", "You do not have permission to view this approval")
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
      return apiError("NOT_FOUND", "Approval request not found")
    }

    const timeline = await getApprovalTimeline(approvalId)

    const hasWorkflow = !!approval.workflowSnapshot
    let stages = hasWorkflow
      ? (await getRequestStageProgress(approvalId)).map(toRuntimeStage)
      : []

    const activeStage = hasWorkflow ? await getCurrentStage(approvalId) : null

    const isRequester = approval.requestedById === session.user.id

    const reviewerIds = new Set(
      approval.decisions.map((d) => d.reviewerId)
    )
    const isAssignedReviewer = stages.some((s) =>
      s.reviewers.some((r) => r.memberId === session.user.id)
    )

    const hasViewAll = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.APPROVAL_VIEW_ALL,
    })

    const filteredDecisions = approval.decisions.map((d) => {
      if (d.comment && !isRequester && !isAssignedReviewer && !hasViewAll && d.reviewerId !== session.user.id) {
        return { ...d, comment: null }
      }
      return d
    })

    const eligibleActions: string[] = []
    if (approval.status === "PENDING") {
      if (isRequester) {
        eligibleActions.push("CANCEL")
      }
      if (hasWorkflow && activeStage) {
        const isStageReviewer = activeStage.reviewers.some(
          (r) => r.memberId === session.user.id
        )
        const hasReviewAny = await hasCirclePermission({
          userId: session.user.id,
          circleId,
          permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_ANY,
        })
        if (isStageReviewer || hasReviewAny) {
          eligibleActions.push("APPROVE", "REJECT")
        }
        const hasEscalate = await hasCirclePermission({
          userId: session.user.id,
          circleId,
          permission: CIRCLE_PERMISSIONS.APPROVAL_ESCALATE,
        })
        if (hasEscalate) {
          eligibleActions.push("ESCALATE", "REASSIGN")
        }
      }
      if (!hasWorkflow) {
        const hasReviewOwn = await hasCirclePermission({
          userId: session.user.id,
          circleId,
          permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_OWN,
        })
        if (hasReviewOwn) {
          eligibleActions.push("APPROVE", "REJECT")
        }
      }
    }

    let currentStageInfo = null
    if (activeStage) {
      const memberIds = activeStage.reviewers.map((r) => r.memberId)
      const members = memberIds.length
        ? await prisma.user.findMany({
            where: { id: { in: memberIds } },
            select: { id: true, name: true, email: true, image: true },
          })
        : []
      const memberMap = new Map(members.map((m) => [m.id, m]))
      currentStageInfo = {
        id: activeStage.id,
        name: activeStage.name,
        order: activeStage.order,
        status: activeStage.status,
        activatedAt: activeStage.activatedAt?.toISOString() ?? null,
        expiresAt: activeStage.expiresAt?.toISOString() ?? null,
        reviewers: activeStage.reviewers.map((r) => ({
          memberId: r.memberId,
          required: r.required,
          member: memberMap.get(r.memberId) ?? null,
        })),
      }
    }

    const isOverdue = approval.expiresAt
      ? approval.status === "PENDING" && new Date() > approval.expiresAt
      : false

    const detail = toApprovalDetail(approval, stages, timeline.events)

    return apiSuccess({
      ...detail,
      decisions: filteredDecisions.map((d) => ({
        id: d.id,
        approvalRequestId: d.approvalRequestId,
        requestStageId: d.requestStageId,
        reviewerId: d.reviewerId,
        originalReviewerId: d.originalReviewerId,
        delegatedReviewerId: d.delegatedReviewerId,
        decision: d.decision,
        comment: d.comment,
        source: d.source,
        actedAt: d.actedAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        reviewer: d.reviewer
          ? { id: d.reviewer.id, name: d.reviewer.name, email: d.reviewer.email, image: d.reviewer.image }
          : null,
      })),
      currentStage: currentStageInfo,
      eligibleActions,
      isOverdue,
      deadline: approval.expiresAt?.toISOString() ?? null,
      escalationState: isOverdue ? "OVERDUE" : activeStage ? "ACTIVE" : "NONE",
    })
  } catch (error) {
    return mapServiceError(error)
  }
}
