import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiCreated, mapServiceError } from "@/lib/api/errors"
import { toWorkflowSummary } from "@/lib/api/dtos"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  getWorkflowById,
  createWorkflow,
} from "@/lib/services/approval-workflow.service"
import { duplicateWorkflowSchema } from "@/lib/validations/approval-workflows"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const { circleId, workflowId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_CREATE)
  if ("error" in access) return access.error

  try {
    const body = await request.json()
    const parsed = duplicateWorkflowSchema.parse(body)

    const original = await getWorkflowById(workflowId)
    if (!original) {
      return mapServiceError(new Error("Workflow not found"))
    }

    const workflow = await createWorkflow({
      circleId,
      name: parsed.name ?? `${original.name} (Copy)`,
      description: original.description,
      type: original.type,
      priority: parsed.priority ?? original.priority,
      minimumAmount: parsed.minimumAmount ?? Number(original.minimumAmount),
      maximumAmount: parsed.maximumAmount ?? Number(original.maximumAmount),
      currency: parsed.currency ?? original.currency,
      isDefault: parsed.isDefault ?? false,
      createdById: access.userId,
      stages: original.stages.map((stage) => ({
        name: stage.name,
        description: stage.description,
        order: stage.order,
        mode: stage.mode as "SEQUENTIAL" | "PARALLEL",
        minimumApprovals: stage.minimumApprovals,
        rejectionThreshold: stage.rejectionThreshold,
        requireAllReviewers: stage.requireAllReviewers,
        allowSelfApproval: stage.allowSelfApproval,
        ownerRequired: stage.ownerRequired,
        expiresAfterHours: stage.expiresAfterHours,
        escalationAfterHours: stage.escalationAfterHours,
        reviewers: stage.reviewers.map((r) => ({
          reviewerType: r.reviewerType as "ROLE" | "MEMBER" | "PERMISSION",
          role: r.role,
          memberId: r.memberId,
          permission: r.permission,
          required: r.required,
        })),
      })),
    })

    return apiCreated(toWorkflowSummary(workflow))
  } catch (error) {
    return mapServiceError(error)
  }
}
