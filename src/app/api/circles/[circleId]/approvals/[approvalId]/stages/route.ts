import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getRequestStageProgress } from "@/lib/services/approval-workflow-engine.service"
import { prisma } from "@/lib/prisma"
import { toRuntimeStage } from "@/lib/api/dtos"
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

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: { id: true, circleId: true, requestedById: true, status: true },
    })
    if (!approval || approval.circleId !== circleId) {
      return apiError("NOT_FOUND", "Approval request not found")
    }

    const isRequester = approval.requestedById === session.user.id

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

    const hasViewAll = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.APPROVAL_VIEW_ALL,
    })

    if (!isRequester && !hasReviewOwn && !hasReviewAny && !hasViewAll) {
      return apiError("FORBIDDEN", "You do not have permission to view stages")
    }

    if (hasReviewOwn && !hasReviewAny && !hasViewAll && !isRequester) {
      const hasAssignment = await prisma.approvalRequestStageReviewer.findFirst({
        where: {
          requestStage: { approvalRequestId: approvalId },
          memberId: session.user.id,
        },
      })
      if (!hasAssignment) {
        return apiError("FORBIDDEN", "You are not assigned to review this approval")
      }
    }

    const rawStages = await getRequestStageProgress(approvalId)
    const stages = rawStages.map(toRuntimeStage)

    return apiSuccess({ stages })
  } catch (error) {
    return mapServiceError(error)
  }
}
