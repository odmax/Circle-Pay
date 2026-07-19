import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, apiCreated, mapServiceError } from "@/lib/api/errors"
import { toWorkflowSummary } from "@/lib/api/dtos"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getWorkflows, createWorkflow } from "@/lib/services/approval-workflow.service"
import { createWorkflowSchema, workflowListQuerySchema } from "@/lib/validations/approval-workflows"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_VIEW)
  if ("error" in access) return access.error

  try {
    const { searchParams } = new URL(request.url)
    const parsed = workflowListQuerySchema.parse(Object.fromEntries(searchParams))

    const workflows = await getWorkflows(circleId, {
      type: parsed.type,
      status: parsed.status,
    })

    let filtered = workflows

    if (parsed.search) {
      const q = parsed.search.toLowerCase()
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description?.toLowerCase().includes(q)
      )
    }

    const total = filtered.length
    const page = parsed.page ?? 1
    const pageSize = parsed.pageSize ?? 20
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return apiSuccess({
      workflows: paged.map(toWorkflowSummary),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    return mapServiceError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params

  const access = await requireCircleAccess(circleId, CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_CREATE)
  if ("error" in access) return access.error

  try {
    const body = await request.json()
    const parsed = createWorkflowSchema.parse(body)

    const workflow = await createWorkflow({
      ...parsed,
      createdById: access.userId,
      circleId,
    })

    return apiCreated(toWorkflowSummary(workflow))
  } catch (error) {
    return mapServiceError(error)
  }
}
