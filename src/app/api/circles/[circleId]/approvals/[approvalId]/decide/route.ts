import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { approveRequest, rejectRequest } from "@/lib/services/approval.service"
import { processStageDecision, getCurrentStage, getRequestStageProgress } from "@/lib/services/approval-workflow-engine.service"
import { prisma } from "@/lib/prisma"
import { approvalDecisionSchema } from "@/lib/validations/approval-workflows"
import { toRuntimeStage } from "@/lib/api/dtos"
import { apiSuccess, apiError, mapServiceError } from "@/lib/api/errors"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", "Authentication required")
  }

  try {
    const { circleId, approvalId } = await params

    const body = await req.json()
    const parsed = approvalDecisionSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten())
    }

    const { decision, comment, stageId } = parsed.data

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: { id: true, circleId: true, status: true, requestedById: true, workflowSnapshot: true },
    })
    if (!approval || approval.circleId !== circleId) {
      return apiError("NOT_FOUND", "Approval request not found")
    }

    if (approval.status !== "PENDING") {
      return apiError("APPROVAL_ALREADY_COMPLETED", "Approval request is not pending")
    }

    const hasWorkflow = !!approval.workflowSnapshot

    if (hasWorkflow) {
      const activeStage = await getCurrentStage(approvalId)
      if (!activeStage) {
        return apiError("APPROVAL_STAGE_NOT_ACTIVE", "No active stage found for this approval")
      }

      if (stageId && stageId !== activeStage.id) {
        return apiError("APPROVAL_STAGE_NOT_ACTIVE", "The specified stage is not the current active stage")
      }

      const resolvedStageId = stageId ?? activeStage.id

      const isAssignedReviewer = activeStage.reviewers.some(
        (r) => r.memberId === session.user.id
      )
      const hasReviewAny = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_ANY,
      })

      if (!isAssignedReviewer && !hasReviewAny) {
        return apiError("APPROVAL_REVIEWER_NOT_ASSIGNED", "You are not assigned as a reviewer for this stage")
      }

      const result = await processStageDecision({
        approvalRequestId: approvalId,
        requestStageId: resolvedStageId,
        reviewerId: session.user.id,
        decision,
        comment: comment ?? null,
      })

      const updatedStages = await getRequestStageProgress(approvalId)
      return apiSuccess({
        ...result,
        stages: updatedStages.map(toRuntimeStage),
      })
    }

    const hasReviewOwn = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_OWN,
    })
    const hasReviewAny = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_ANY,
    })

    if (!hasReviewOwn && !hasReviewAny) {
      return apiError("APPROVAL_REVIEWER_NOT_ASSIGNED", "You do not have review permission")
    }

    if (approval.requestedById === session.user.id && !hasReviewAny) {
      return apiError("APPROVAL_SELF_REVIEW_FORBIDDEN", "Cannot review your own request")
    }

    if (decision === "APPROVE") {
      const result = await approveRequest({
        approvalRequestId: approvalId,
        reviewerId: session.user.id,
        comment: comment ?? null,
      })
      return apiSuccess(result)
    } else {
      const result = await rejectRequest({
        approvalRequestId: approvalId,
        reviewerId: session.user.id,
        comment: comment ?? null,
      })
      return apiSuccess(result)
    }
  } catch (error) {
    return mapServiceError(error)
  }
}
