import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getApprovalStats } from "@/lib/services/approval.service"
import { prisma } from "@/lib/prisma"
import { apiSuccess, apiError, mapServiceError } from "@/lib/api/errors"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", "Authentication required")
  }

  try {
    const { circleId } = await params

    const { searchParams } = req.nextUrl
    const scope = (searchParams.get("scope") ?? "all") as "mine" | "all"

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

    const hasReviewOwn = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_OWN,
    })

    if (scope === "mine" && !hasReviewOwn && !hasReviewAny && !hasViewAll) {
      return apiError("FORBIDDEN", "You do not have permission to view personal stats")
    }

    if (scope === "all" && !hasReviewAny && !hasViewAll) {
      const canView = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
      })
      if (!canView) {
        return apiError("FORBIDDEN", "You do not have permission to view approval stats")
      }
    }

    const baseStats = await getApprovalStats(circleId)

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (scope === "mine") {
      const [assignedToMe, delegatedToMe, overdue] = await Promise.all([
        prisma.approvalRequestStageReviewer.count({
          where: {
            memberId: session.user.id,
            requestStage: {
              approvalRequest: { circleId, status: "PENDING" },
              status: "ACTIVE",
            },
          },
        }),
        prisma.approvalRequestStageReviewer.count({
          where: {
            delegatedFromMemberId: session.user.id,
            memberId: { not: session.user.id },
            requestStage: {
              approvalRequest: { circleId, status: "PENDING" },
              status: "ACTIVE",
            },
          },
        }),
        prisma.approvalRequestStage.count({
          where: {
            status: "ACTIVE",
            expiresAt: { lt: now },
            approvalRequest: { circleId, status: "PENDING" },
          },
        }),
      ])

      return apiSuccess({
        ...baseStats,
        assignedToMe,
        delegatedToMe,
        overdue,
      })
    }

    const pendingByWorkflowRaw = await prisma.approvalRequest.findMany({
      where: {
        circleId,
        status: "PENDING",
      },
      select: {
        id: true,
        workflowSnapshot: true,
      },
    })

    const workflowMap = new Map<string, { workflowId: string; workflowName: string; count: number }>()
    for (const r of pendingByWorkflowRaw) {
      if (r.workflowSnapshot && typeof r.workflowSnapshot === "object") {
        const snap = r.workflowSnapshot as Record<string, unknown>
        const wfId = (snap.workflowId as string) ?? "unknown"
        const wfName = (snap.workflowName as string) ?? "Unknown Workflow"
        const existing = workflowMap.get(wfId)
        if (existing) {
          existing.count++
        } else {
          workflowMap.set(wfId, { workflowId: wfId, workflowName: wfName, count: 1 })
        }
      }
    }
    const pendingByWorkflow = Array.from(workflowMap.values())

    const overdueCount = await prisma.approvalRequest.count({
      where: {
        circleId,
        status: "PENDING",
        expiresAt: { lt: now },
      },
    })

    const escalatedCount = await prisma.approvalRequestDecision.count({
      where: {
        approvalRequest: { circleId, status: "PENDING" },
        source: "ESCALATION",
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    })

    return apiSuccess({
      ...baseStats,
      pendingByWorkflow: pendingByWorkflow,
      overdue: overdueCount,
      escalated: escalatedCount,
    })
  } catch (error) {
    return mapServiceError(error)
  }
}
