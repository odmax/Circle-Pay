import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, mapServiceError } from "@/lib/api/errors"
import { toWorkflowStage } from "@/lib/api/dtos"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { prisma } from "@/lib/prisma"
import { selectWorkflowForRequest } from "@/lib/services/approval-workflow.service"
import { workflowPreviewSchema } from "@/lib/validations/approval-workflows"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_VIEW)
  if ("error" in access) return access.error

  try {
    const body = await request.json()
    const parsed = workflowPreviewSchema.parse(body)

    const workflow = await selectWorkflowForRequest({
      circleId,
      type: parsed.approvalType,
      amount: parsed.amount,
      currency: parsed.currency,
    })

    if (!workflow) {
      return apiSuccess({
        workflowSelected: false,
        workflowId: null,
        workflowName: null,
        workflowVersion: null,
        fallbackPath: true,
        stages: [],
        resolvedReviewers: [],
        excludedReviewers: [],
        selfApprovalConflicts: [],
        missingReviewerWarnings: [],
        estimatedExpiry: null,
        finalisationPossible: false,
      })
    }

    const memberIds = new Set<string>()
    for (const stage of workflow.stages) {
      for (const reviewer of stage.reviewers) {
        if (reviewer.memberId) memberIds.add(reviewer.memberId)
      }
    }

    const members = memberIds.size > 0
      ? await prisma.circleMember.findMany({
          where: { circleId, userId: { in: Array.from(memberIds) } },
          select: {
            userId: true,
            role: true,
            permissions: { select: { permission: true, granted: true } },
          },
        })
      : []

    const allCircleMembers = await prisma.circleMember.findMany({
      where: { circleId },
      select: {
        userId: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        role: true,
        permissions: { select: { permission: true, granted: true } },
      },
    })

    const resolvedReviewers: Array<{
      stageName: string
      stageOrder: number
      memberId: string
      memberName: string | null
      isDelegated: boolean
      delegatedFrom: string | null
    }> = []

    const excludedReviewers: Array<{ memberId: string; reason: string }> = []
    const selfApprovalConflicts: Array<{ stageName: string; memberId: string }> = []
    const missingReviewerWarnings: Array<{ stageName: string; message: string }> = []

    let totalExpiryHours = 0

    for (const stage of workflow.stages) {
      const resolvedIds = new Set<string>()

      for (const wfReviewer of stage.reviewers) {
        let candidateIds: string[] = []

        if (wfReviewer.reviewerType === "MEMBER" && wfReviewer.memberId) {
          candidateIds = [wfReviewer.memberId]
        } else if (wfReviewer.reviewerType === "ROLE" && wfReviewer.role) {
          candidateIds = allCircleMembers
            .filter((m) => m.role === wfReviewer.role)
            .map((m) => m.userId)
        } else if (wfReviewer.reviewerType === "PERMISSION" && wfReviewer.permission) {
          candidateIds = allCircleMembers
            .filter((m) =>
              m.permissions.some((p) => p.permission === wfReviewer.permission && p.granted)
            )
            .map((m) => m.userId)
        }

        for (const memberId of candidateIds) {
          if (resolvedIds.has(memberId)) continue
          resolvedIds.add(memberId)

          const delegation = await prisma.approvalDelegation.findFirst({
            where: {
              circleId,
              delegateMemberId: memberId,
              status: "ACTIVE",
              startsAt: { lte: new Date() },
              endsAt: { gte: new Date() },
            },
          })

          const memberRecord = allCircleMembers.find((m) => m.userId === memberId)

          resolvedReviewers.push({
            stageName: stage.name,
            stageOrder: stage.order,
            memberId,
            memberName: memberRecord?.user?.name ?? null,
            isDelegated: !!delegation,
            delegatedFrom: delegation ? delegation.delegatorMemberId : null,
          })
        }

        if (candidateIds.length === 0) {
          missingReviewerWarnings.push({
            stageName: stage.name,
            message: `No members resolved for reviewer rule (${wfReviewer.reviewerType}${wfReviewer.role ? `: ${wfReviewer.role}` : ""}${wfReviewer.permission ? `: ${wfReviewer.permission}` : ""})`,
          })
        }
      }

      if (stage.expiresAfterHours) {
        totalExpiryHours += stage.expiresAfterHours
      }
    }

    const estimatedExpiry = totalExpiryHours > 0
      ? new Date(Date.now() + totalExpiryHours * 60 * 60 * 1000).toISOString()
      : null

    return apiSuccess({
      workflowSelected: true,
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowVersion: workflow.version,
      fallbackPath: false,
      stages: workflow.stages.map(toWorkflowStage),
      resolvedReviewers,
      excludedReviewers,
      selfApprovalConflicts,
      missingReviewerWarnings,
      estimatedExpiry,
      finalisationPossible: missingReviewerWarnings.length === 0,
    })
  } catch (error) {
    return mapServiceError(error)
  }
}
