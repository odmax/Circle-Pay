import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { cancelRequest } from "@/lib/services/approval.service"
import { prisma } from "@/lib/prisma"
import { cancelApprovalSchema } from "@/lib/validations/approval-workflows"
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
    const parsed = cancelApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten())
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: { id: true, circleId: true, requestedById: true, status: true },
    })
    if (!approval || approval.circleId !== circleId) {
      return apiError("NOT_FOUND", "Approval request not found")
    }

    if (approval.status !== "PENDING") {
      return apiError("APPROVAL_ALREADY_COMPLETED", "Only pending approvals can be cancelled")
    }

    const isRequester = approval.requestedById === session.user.id

    if (!isRequester) {
      const hasEscalate = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.APPROVAL_ESCALATE,
      })

      if (!hasEscalate) {
        return apiError("FORBIDDEN", "Only the requester or an admin can cancel this approval")
      }
    }

    const updated = await cancelRequest({
      approvalRequestId: approvalId,
      userId: session.user.id,
    })

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt?.toISOString() ?? null,
    })
  } catch (error) {
    return mapServiceError(error)
  }
}
