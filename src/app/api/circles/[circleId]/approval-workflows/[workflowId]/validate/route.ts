import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, mapServiceError } from "@/lib/api/errors"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  getWorkflowById,
  validateWorkflow,
} from "@/lib/services/approval-workflow.service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const { circleId, workflowId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_VIEW)
  if ("error" in access) return access.error

  try {
    const workflow = await getWorkflowById(workflowId)
    if (!workflow) {
      return mapServiceError(new Error("Workflow not found"))
    }

    const result = await validateWorkflow({
      circleId,
      stages: workflow.stages.map((s) => ({
        name: s.name,
        description: s.description,
        order: s.order,
        mode: s.mode as "SEQUENTIAL" | "PARALLEL",
        minimumApprovals: s.minimumApprovals,
        rejectionThreshold: s.rejectionThreshold,
        requireAllReviewers: s.requireAllReviewers,
        allowSelfApproval: s.allowSelfApproval,
        ownerRequired: s.ownerRequired,
        expiresAfterHours: s.expiresAfterHours,
        escalationAfterHours: s.escalationAfterHours,
        reviewers: s.reviewers.map((r) => ({
          reviewerType: r.reviewerType as "ROLE" | "MEMBER" | "PERMISSION",
          role: r.role,
          memberId: r.memberId,
          permission: r.permission,
          required: r.required,
        })),
      })),
      isDefault: workflow.isDefault,
      type: workflow.type,
      workflowId,
    })

    return apiSuccess(result)
  } catch (error) {
    return mapServiceError(error)
  }
}
