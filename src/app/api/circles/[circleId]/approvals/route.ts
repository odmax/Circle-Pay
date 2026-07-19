import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  createApprovalRequest,
} from "@/lib/services/approval.service"
import { prisma } from "@/lib/prisma"
import { apiSuccess, apiCreated, apiError, mapServiceError } from "@/lib/api/errors"
import { requireCircleAccess } from "@/lib/api/auth"
import type { ApprovalType, ApprovalStatus } from "@/generated/prisma"

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
    const scope = (searchParams.get("scope") ?? "all") as
      | "mine"
      | "delegated"
      | "all"
      | "requestedByMe"
      | "overdue"
      | "escalated"
      | "completed"
    const type = searchParams.get("type") as ApprovalType | null
    const status = searchParams.get("status") as ApprovalStatus | null
    const workflowId = searchParams.get("workflowId") ?? undefined
    const search = searchParams.get("search") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20") || 20))
    const skip = (page - 1) * pageSize

    if (scope === "mine" || scope === "delegated") {
      const hasReviewOwn = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_OWN,
      })
      if (!hasReviewOwn) {
        return apiError("FORBIDDEN", "You do not have APPROVAL_REVIEW_OWN permission")
      }
    }

    if (scope === "all") {
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
      const hasView = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
      })
      if (!hasReviewAny && !hasViewAll && !hasView) {
        return apiError("FORBIDDEN", "You do not have permission to view all approvals")
      }
    }

    if (scope === "requestedByMe") {
      const canView = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
      })
      if (!canView) {
        return apiError("FORBIDDEN", "You do not have permission to view approvals")
      }
    }

    if (scope === "overdue" || scope === "escalated" || scope === "completed") {
      const hasViewAll = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.APPROVAL_VIEW_ALL,
      })
      const hasView = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
      })
      if (!hasViewAll && !hasView) {
        return apiError("FORBIDDEN", "You do not have permission")
      }
    }

    const now = new Date()

    if (scope === "mine") {
      const reviewerStageWhere = {
        memberId: session.user.id,
        requestStage: {
          approvalRequest: { circleId, status: "PENDING" as const },
          status: "ACTIVE" as const,
        },
      }

      const reviewerIds = await prisma.approvalRequestStageReviewer.findMany({
        where: reviewerStageWhere,
        select: { requestStage: { select: { approvalRequestId: true } } },
      })

      const requestIds = [...new Set(reviewerIds.map((r) => r.requestStage.approvalRequestId))]

      const where: Record<string, unknown> = {
        circleId,
        id: { in: requestIds },
      }

      if (type) where.type = type
      if (status) where.status = status
      if (workflowId) {
        where.workflowSnapshot = { path: ["workflowId"], equals: workflowId }
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: r.expiresAt ? now > r.expiresAt : false,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    if (scope === "delegated") {
      const delegatedStages = await prisma.approvalRequestStageReviewer.findMany({
        where: {
          delegatedFromMemberId: session.user.id,
          memberId: { not: session.user.id },
          requestStage: {
            approvalRequest: { circleId, status: "PENDING" as const },
            status: "ACTIVE" as const,
          },
        },
        select: { requestStage: { select: { approvalRequestId: true } } },
      })

      const requestIds = [...new Set(delegatedStages.map((r) => r.requestStage.approvalRequestId))]

      const where: Record<string, unknown> = {
        circleId,
        id: { in: requestIds },
      }

      if (type) where.type = type
      if (status) where.status = status
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: r.expiresAt ? now > r.expiresAt : false,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    if (scope === "requestedByMe") {
      const where: Record<string, unknown> = {
        circleId,
        requestedById: session.user.id,
      }

      if (type) where.type = type
      if (status) where.status = status
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: r.expiresAt ? now > r.expiresAt : false,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    if (scope === "overdue") {
      const where: Record<string, unknown> = {
        circleId,
        status: "PENDING",
        expiresAt: { lt: now },
      }

      if (type) where.type = type
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { expiresAt: "asc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: true,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    if (scope === "escalated") {
      const escalatedRequestIds = await prisma.approvalRequestDecision.findMany({
        where: {
          approvalRequest: { circleId, status: "PENDING" },
          source: "ESCALATION",
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { approvalRequestId: true },
        distinct: ["approvalRequestId"],
      })

      const requestIds = escalatedRequestIds.map((r) => r.approvalRequestId)

      const where: Record<string, unknown> = {
        circleId,
        id: { in: requestIds },
      }

      if (type) where.type = type
      if (status) where.status = status
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: r.expiresAt ? now > r.expiresAt : false,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    if (scope === "completed") {
      const where: Record<string, unknown> = {
        circleId,
        status: { in: ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"] },
      }

      if (type) where.type = type
      if (status && status !== "PENDING") where.status = status
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: r.expiresAt ? now > r.expiresAt : false,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    const where: Record<string, unknown> = { circleId }

    if (type) where.type = type
    if (status) where.status = status
    if (workflowId) {
      where.workflowSnapshot = { path: ["workflowId"], equals: workflowId }
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (status && status !== "PENDING") {
      const [requests, total] = await Promise.all([
        prisma.approvalRequest.findMany({
          where: where as any,
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.approvalRequest.count({ where: where as any }),
      ])

      return apiSuccess({
        requests: requests.map((r) => ({
          ...r,
          amount: r.amount ? Number(r.amount) : null,
          isExpired: r.expiresAt ? now > r.expiresAt : false,
          approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
        })),
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
      })
    }

    const [requests, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: { ...where, status: "PENDING" } as any,
        include: {
          requestedBy: { select: { id: true, name: true, email: true, image: true } },
          decisions: {
            include: {
              reviewer: { select: { id: true, name: true, email: true, image: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.approvalRequest.count({ where: { ...where, status: "PENDING" } as any }),
    ])

    return apiSuccess({
      requests: requests.map((r) => ({
        ...r,
        amount: r.amount ? Number(r.amount) : null,
        isExpired: r.expiresAt ? now > r.expiresAt : false,
        approvalsNeeded: Math.max(0, r.minimumApprovals - r.currentApprovals),
      })),
      total,
      page,
      pageSize,
      hasMore: skip + pageSize < total,
    })
  } catch (error) {
    return mapServiceError(error)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", "Authentication required")
  }

  try {
    const { circleId } = await params
    const authResult = await requireCircleAccess(circleId)
    if ("error" in authResult) return authResult.error

    const body = await req.json()
    const { type, resourceId, title, description, amount, currency, metadata } = body as {
      type: ApprovalType
      resourceId?: string
      title: string
      description?: string
      amount?: number
      currency?: string
      metadata?: Record<string, unknown>
    }

    if (!type || !title) {
      return apiError("VALIDATION_ERROR", "type and title are required")
    }

    const approvalRequest = await createApprovalRequest({
      circleId,
      type,
      resourceId,
      title,
      description,
      requestedById: session.user.id,
      amount,
      currency,
      metadata,
    })

    return apiCreated({
      id: approvalRequest.id,
      type: approvalRequest.type,
      status: approvalRequest.status,
      title: approvalRequest.title,
      amount: approvalRequest.amount ? Number(approvalRequest.amount) : null,
      currency: approvalRequest.currency,
      requestedById: approvalRequest.requestedById,
      minimumApprovals: approvalRequest.minimumApprovals,
      createdAt: approvalRequest.createdAt.toISOString(),
    })
  } catch (error) {
    return mapServiceError(error)
  }
}
