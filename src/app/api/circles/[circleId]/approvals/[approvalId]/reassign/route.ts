import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { prisma } from "@/lib/prisma"
import { reviewerReassignmentSchema } from "@/lib/validations/approval-workflows"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification } from "@/lib/services/notification.service"
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

    const hasEscalate = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.APPROVAL_ESCALATE,
    })
    if (!hasEscalate) {
      return apiError("FORBIDDEN", "You do not have permission to reassign reviewers")
    }

    const body = await req.json()
    const parsed = reviewerReassignmentSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten())
    }

    const { requestStageReviewerId, replacementMemberId, reason } = parsed.data

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: {
        id: true,
        circleId: true,
        status: true,
        title: true,
        currentStageId: true,
      },
    })
    if (!approval || approval.circleId !== circleId) {
      return apiError("NOT_FOUND", "Approval request not found")
    }

    if (approval.status !== "PENDING") {
      return apiError("APPROVAL_ALREADY_COMPLETED", "Only pending approvals can be reassigned")
    }

    if (!approval.currentStageId) {
      return apiError("APPROVAL_STAGE_NOT_ACTIVE", "No active stage for reassignment")
    }

    const reviewerRecord = await prisma.approvalRequestStageReviewer.findUnique({
      where: { id: requestStageReviewerId },
      include: {
        requestStage: { select: { id: true, approvalRequestId: true, status: true, name: true } },
      },
    })
    if (!reviewerRecord) {
      return apiError("NOT_FOUND", "Reviewer record not found")
    }

    if (reviewerRecord.requestStage.approvalRequestId !== approvalId) {
      return apiError("VALIDATION_ERROR", "Reviewer does not belong to this approval")
    }

    if (reviewerRecord.requestStage.id !== approval.currentStageId) {
      return apiError("APPROVAL_STAGE_NOT_ACTIVE", "Can only reassign reviewers on the current active stage")
    }

    if (reviewerRecord.requestStage.status !== "ACTIVE") {
      return apiError("APPROVAL_STAGE_NOT_ACTIVE", "Stage is not active")
    }

    const member = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId: replacementMemberId } },
    })
    if (!member) {
      return apiError("NOT_FOUND", "Replacement user is not a member of this circle")
    }

    const duplicateReviewer = await prisma.approvalRequestStageReviewer.findFirst({
      where: {
        requestStageId: approval.currentStageId,
        memberId: replacementMemberId,
        id: { not: requestStageReviewerId },
      },
    })
    if (duplicateReviewer) {
      return apiError("CONFLICT", "Replacement member is already a reviewer for this stage")
    }

    const originalMemberId = reviewerRecord.memberId
    if (originalMemberId === replacementMemberId) {
      return apiError("VALIDATION_ERROR", "Replacement member is the same as the current reviewer")
    }

    const updatedReviewer = await prisma.approvalRequestStageReviewer.update({
      where: { id: requestStageReviewerId },
      data: {
        memberId: replacementMemberId,
        delegatedFromMemberId: reviewerRecord.delegatedFromMemberId ?? originalMemberId,
      },
    })

    createNotification({
      userId: replacementMemberId,
      circleId,
      type: "APPROVAL_ASSIGNED",
      title: `Reassigned: ${approval.title}`,
      message: `You have been reassigned as a reviewer for stage "${reviewerRecord.requestStage.name}". Reason: ${reason}`,
      link: `/circles/${circleId}/approvals/${approvalId}`,
    }).catch(console.error)

    await createAuditLog({
      userId: session.user.id,
      circleId,
      action: "REASSIGNED",
      entityType: "ApprovalRequestStageReviewer",
      entityId: requestStageReviewerId,
      oldValues: { memberId: originalMemberId },
      newValues: { memberId: replacementMemberId, reason },
    })

    return apiSuccess({
      id: updatedReviewer.id,
      previousMemberId: originalMemberId,
      newMemberId: replacementMemberId,
    })
  } catch (error) {
    return mapServiceError(error)
  }
}
