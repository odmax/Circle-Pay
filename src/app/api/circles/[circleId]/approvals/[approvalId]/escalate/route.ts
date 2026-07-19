import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { prisma } from "@/lib/prisma"
import { manualEscalationSchema } from "@/lib/validations/approval-workflows"
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
      return apiError("FORBIDDEN", "You do not have permission to escalate approvals")
    }

    const body = await req.json()
    const parsed = manualEscalationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten())
    }

    const { action, reason, targetMemberId } = parsed.data

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: {
        id: true,
        circleId: true,
        status: true,
        title: true,
        currentStageId: true,
        requestedById: true,
      },
    })
    if (!approval || approval.circleId !== circleId) {
      return apiError("NOT_FOUND", "Approval request not found")
    }

    if (approval.status !== "PENDING") {
      return apiError("APPROVAL_ALREADY_COMPLETED", "Only pending approvals can be escalated")
    }

    if (!approval.currentStageId) {
      return apiError("APPROVAL_STAGE_NOT_ACTIVE", "No active stage to escalate")
    }

    const activeStage = await prisma.approvalRequestStage.findUnique({
      where: { id: approval.currentStageId },
      include: { reviewers: true },
    })
    if (!activeStage || activeStage.status !== "ACTIVE") {
      return apiError("APPROVAL_STAGE_NOT_ACTIVE", "Current stage is not active")
    }

    if (action === "NOTIFY") {
      const ownerMembers = await prisma.circleMember.findMany({
        where: { circleId, role: "OWNER" },
        select: { userId: true },
      })

      for (const owner of ownerMembers) {
        createNotification({
          userId: owner.userId,
          circleId,
          type: "APPROVAL_ESCALATED",
          title: `Escalation: ${approval.title}`,
          message: `An escalation has been triggered on stage "${activeStage.name}". Reason: ${reason}`,
          link: `/circles/${circleId}/approvals/${approvalId}`,
        }).catch(console.error)
      }

      await createAuditLog({
        userId: session.user.id,
        circleId,
        action: "ESCALATED",
        entityType: "ApprovalRequestStage",
        entityId: activeStage.id,
        newValues: {
          action: "NOTIFY",
          reason,
          stageName: activeStage.name,
          requestTitle: approval.title,
        },
      })

      return apiSuccess({ action: "NOTIFY", notified: ownerMembers.length })
    }

    if (action === "REASSIGN") {
      if (!targetMemberId) {
        return apiError("VALIDATION_ERROR", "targetMemberId is required for REASSIGN")
      }

      const member = await prisma.circleMember.findUnique({
        where: { circleId_userId: { circleId, userId: targetMemberId } },
      })
      if (!member) {
        return apiError("NOT_FOUND", "Target user is not a member of this circle")
      }

      const existingReviewer = activeStage.reviewers.find(
        (r) => r.memberId === targetMemberId
      )
      if (existingReviewer) {
        return apiError("CONFLICT", "Target member is already a reviewer for this stage")
      }

      const originalReviewerId = activeStage.reviewers[0]?.memberId
      if (!originalReviewerId) {
        return apiError("APPROVAL_STAGE_NOT_ACTIVE", "No reviewer to reassign")
      }

      await prisma.approvalRequestStageReviewer.update({
        where: { id: activeStage.reviewers[0].id },
        data: {
          memberId: targetMemberId,
          delegatedFromMemberId: originalReviewerId,
        },
      })

      createNotification({
        userId: targetMemberId,
        circleId,
        type: "APPROVAL_ASSIGNED",
        title: `Reassigned: ${approval.title}`,
        message: `You have been reassigned as a reviewer for stage "${activeStage.name}". Reason: ${reason}`,
        link: `/circles/${circleId}/approvals/${approvalId}`,
      }).catch(console.error)

      await createAuditLog({
        userId: session.user.id,
        circleId,
        action: "REASSIGNED",
        entityType: "ApprovalRequestStageReviewer",
        entityId: activeStage.reviewers[0].id,
        oldValues: { memberId: originalReviewerId },
        newValues: { memberId: targetMemberId, reason },
      })

      return apiSuccess({ action: "REASSIGN", reassignedTo: targetMemberId })
    }

    if (action === "SKIP_STAGE") {
      await prisma.$transaction(async (tx) => {
        await tx.approvalRequestStage.update({
          where: { id: activeStage.id },
          data: { status: "APPROVED", completedAt: new Date() },
        })

        const nextStage = await tx.approvalRequestStage.findFirst({
          where: { approvalRequestId: approvalId, status: "WAITING" },
          orderBy: { order: "asc" },
        })

        if (nextStage) {
          await tx.approvalRequestStage.update({
            where: { id: nextStage.id },
            data: { status: "ACTIVE", activatedAt: new Date() },
          })
          await tx.approvalRequest.update({
            where: { id: approvalId },
            data: { currentStageId: nextStage.id },
          })

          const nextWithReviewers = await tx.approvalRequestStage.findUnique({
            where: { id: nextStage.id },
            include: { reviewers: true },
          })
          if (nextWithReviewers) {
            for (const reviewer of nextWithReviewers.reviewers) {
              createNotification({
                userId: reviewer.memberId,
                circleId,
                type: "APPROVAL_STAGE_ACTIVATED",
                title: `New stage active: ${nextStage.name}`,
                message: `Stage "${nextStage.name}" is now active after a stage skip.`,
                link: `/circles/${circleId}/approvals/${approvalId}`,
              }).catch(console.error)
            }
          }
        } else {
          await tx.approvalRequest.update({
            where: { id: approvalId },
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
              completedAt: new Date(),
              currentStageId: null,
            },
          })
        }

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            circleId,
            action: "ESCALATED",
            entityType: "ApprovalRequestStage",
            entityId: activeStage.id,
            oldValues: { status: "ACTIVE" },
            newValues: { action: "SKIP_STAGE", reason, skippedStageName: activeStage.name },
          },
        })
      })

      return apiSuccess({ action: "SKIP_STAGE", skippedStage: activeStage.name })
    }

    return apiError("VALIDATION_ERROR", "Invalid escalation action")
  } catch (error) {
    return mapServiceError(error)
  }
}
