import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, mapServiceError } from "@/lib/api/errors"
import { toWorkflowSummary } from "@/lib/api/dtos"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { changeWorkflowStatus } from "@/lib/services/approval-workflow.service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const { circleId, workflowId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_ACTIVATE)
  if ("error" in access) return access.error

  try {
    const workflow = await changeWorkflowStatus({
      workflowId,
      userId: access.userId,
      status: "ACTIVE",
    })

    return apiSuccess(toWorkflowSummary(workflow))
  } catch (error) {
    return mapServiceError(error)
  }
}
