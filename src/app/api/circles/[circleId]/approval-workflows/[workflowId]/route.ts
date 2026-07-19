import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, mapServiceError } from "@/lib/api/errors"
import { toWorkflowDetail, toWorkflowSummary } from "@/lib/api/dtos"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
} from "@/lib/services/approval-workflow.service"
import { updateWorkflowSchema } from "@/lib/validations/approval-workflows"

export async function GET(
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

    return apiSuccess(toWorkflowDetail(workflow))
  } catch (error) {
    return mapServiceError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const { circleId, workflowId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_UPDATE)
  if ("error" in access) return access.error

  try {
    const body = await request.json()
    const parsed = updateWorkflowSchema.parse(body)

    const workflow = await updateWorkflow({
      workflowId,
      userId: access.userId,
      ...parsed,
    })

    return apiSuccess(toWorkflowDetail(workflow))
  } catch (error) {
    return mapServiceError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const { circleId, workflowId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_ARCHIVE)
  if ("error" in access) return access.error

  try {
    await deleteWorkflow({ workflowId, userId: access.userId })

    return apiSuccess({ deleted: true })
  } catch (error) {
    return mapServiceError(error)
  }
}
