import { prisma } from "@/lib/prisma"
import type { ApprovalType, ApprovalStatus, ApprovalDecision } from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission, getCircleMemberPermissions } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification, notifyCircleMembers } from "@/lib/services/notification.service"

// ─── Types & Defaults ─────────────────────────────────────

export interface ApprovalSettings {
  enabled: boolean
  minimumApprovals: number
  allowedRoles: string[]
  ownerRequiredAboveAmount: number | null
  expiryDays: number | null
}

export interface CircleApprovalConfig {
  contribution?: ApprovalSettings
  expense?: ApprovalSettings
  project?: ApprovalSettings
  walletWithdrawal?: ApprovalSettings
  settlement?: ApprovalSettings
}

export const DEFAULT_APPROVAL_SETTINGS: CircleApprovalConfig = {
  contribution: { enabled: false, minimumApprovals: 1, allowedRoles: ["OWNER", "ADMIN", "TREASURER"], ownerRequiredAboveAmount: null, expiryDays: 7 },
  expense: { enabled: false, minimumApprovals: 1, allowedRoles: ["OWNER", "ADMIN"], ownerRequiredAboveAmount: null, expiryDays: 7 },
  project: { enabled: false, minimumApprovals: 2, allowedRoles: ["OWNER", "ADMIN"], ownerRequiredAboveAmount: null, expiryDays: 14 },
  walletWithdrawal: { enabled: false, minimumApprovals: 2, allowedRoles: ["OWNER", "ADMIN", "TREASURER"], ownerRequiredAboveAmount: 10000, expiryDays: 7 },
  settlement: { enabled: false, minimumApprovals: 1, allowedRoles: ["OWNER", "ADMIN", "TREASURER"], ownerRequiredAboveAmount: null, expiryDays: 7 },
}

const REVIEW_PERMISSION_MAP: Record<string, string> = {
  CONTRIBUTION: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW,
  EXPENSE: CIRCLE_PERMISSIONS.EXPENSE_APPROVE,
  SETTLEMENT: CIRCLE_PERMISSIONS.SETTLEMENT_CONFIRM,
  PROJECT: CIRCLE_PERMISSIONS.PROJECT_APPROVE,
  WALLET_WITHDRAWAL: CIRCLE_PERMISSIONS.PAYOUT_APPROVE,
  WALLET_TRANSFER: CIRCLE_PERMISSIONS.PAYOUT_APPROVE,
  GOAL_WITHDRAWAL: CIRCLE_PERMISSIONS.GOAL_UPDATE,
  JOIN_REQUEST: CIRCLE_PERMISSIONS.JOIN_REQUEST_REVIEW,
  MEMBER_PROMOTION: CIRCLE_PERMISSIONS.MEMBER_ROLE_UPDATE,
  OTHER: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW,
}

const REJECT_PERMISSION_MAP: Record<string, string> = {
  CONTRIBUTION: CIRCLE_PERMISSIONS.CONTRIBUTION_REJECT,
  EXPENSE: CIRCLE_PERMISSIONS.EXPENSE_APPROVE,
  SETTLEMENT: CIRCLE_PERMISSIONS.SETTLEMENT_CONFIRM,
  PROJECT: CIRCLE_PERMISSIONS.PROJECT_APPROVE,
  WALLET_WITHDRAWAL: CIRCLE_PERMISSIONS.PAYOUT_APPROVE,
  WALLET_TRANSFER: CIRCLE_PERMISSIONS.PAYOUT_APPROVE,
  GOAL_WITHDRAWAL: CIRCLE_PERMISSIONS.GOAL_UPDATE,
  JOIN_REQUEST: CIRCLE_PERMISSIONS.JOIN_REQUEST_REVIEW,
  MEMBER_PROMOTION: CIRCLE_PERMISSIONS.MEMBER_ROLE_UPDATE,
  OTHER: CIRCLE_PERMISSIONS.CONTRIBUTION_REJECT,
}

const APPROVAL_TYPE_SETTINGS_MAP: Record<string, keyof CircleApprovalConfig> = {
  CONTRIBUTION: "contribution",
  EXPENSE: "expense",
  PROJECT: "project",
  WALLET_WITHDRAWAL: "walletWithdrawal",
  WALLET_TRANSFER: "walletWithdrawal",
  GOAL_WITHDRAWAL: "walletWithdrawal",
  SETTLEMENT: "settlement",
  JOIN_REQUEST: "contribution",
  MEMBER_PROMOTION: "contribution",
  OTHER: "contribution",
}

// ─── Helper: Get Approval Config ──────────────────────────

export async function getApprovalConfig(circleId: string): Promise<CircleApprovalConfig> {
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: { settings: true },
  })
  if (!circle) throw new Error("Circle not found")

  const settings = (circle.settings as Record<string, unknown>)?.approvalConfig as CircleApprovalConfig | undefined
  if (!settings) return { ...DEFAULT_APPROVAL_SETTINGS }

  const merge = (def: ApprovalSettings, custom?: Partial<ApprovalSettings>): ApprovalSettings => ({
    ...def,
    ...custom,
  })

  return {
    contribution: merge(DEFAULT_APPROVAL_SETTINGS.contribution!, settings.contribution),
    expense: merge(DEFAULT_APPROVAL_SETTINGS.expense!, settings.expense),
    project: merge(DEFAULT_APPROVAL_SETTINGS.project!, settings.project),
    walletWithdrawal: merge(DEFAULT_APPROVAL_SETTINGS.walletWithdrawal!, settings.walletWithdrawal),
    settlement: merge(DEFAULT_APPROVAL_SETTINGS.settlement!, settings.settlement),
  }
}

// ─── Reviewer Queries ────────────────────────────────────

export async function getCircleReviewers(circleId: string): Promise<string[]> {
  const members = await prisma.circleMember.findMany({
    where: { circleId },
    select: {
      userId: true,
      role: true,
      permissions: {
        select: { permission: true, granted: true },
      },
    },
  })

  const reviewerIds: string[] = []

  for (const member of members) {
    if (member.role === "OWNER" || member.role === "ADMIN" || member.role === "TREASURER") {
      reviewerIds.push(member.userId)
      continue
    }

    const hasReviewPerm = member.permissions.some(
      (p) => p.permission === CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW && p.granted
    )
    if (hasReviewPerm) {
      reviewerIds.push(member.userId)
    }
  }

  return reviewerIds
}

// ─── 1. Create Approval Request ───────────────────────────

export async function createApprovalRequest(data: {
  circleId: string
  type: ApprovalType
  resourceId?: string | null
  title: string
  description?: string | null
  requestedById: string
  amount?: number | null
  currency?: string | null
  metadata?: Record<string, unknown> | null
  expiresAt?: Date | null
}) {
  const config = await getApprovalConfig(data.circleId)
  const typeKey = APPROVAL_TYPE_SETTINGS_MAP[data.type] ?? "contribution"
  const settings = config[typeKey] ?? config.contribution

  let minimumApprovals = 1
  let expiresAt = data.expiresAt ?? null

  if (settings) {
    minimumApprovals = settings.minimumApprovals ?? 1

    if (!expiresAt && settings.expiryDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + settings.expiryDays)
    }
  }

  const request = await prisma.approvalRequest.create({
    data: {
      circleId: data.circleId,
      type: data.type,
      resourceId: data.resourceId || null,
      title: data.title,
      description: data.description || null,
      requestedById: data.requestedById,
      minimumApprovals,
      currentApprovals: 0,
      amount: data.amount ?? null,
      currency: data.currency || null,
      ...(data.metadata != null ? { metadata: data.metadata as any } : {}),
      expiresAt: expiresAt || null,
    },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  await createAuditLog({
    userId: data.requestedById,
    circleId: data.circleId,
    action: "CREATED",
    entityType: "ApprovalRequest",
    entityId: request.id,
    newValues: {
      type: data.type,
      title: data.title,
      minimumApprovals,
      resourceId: data.resourceId,
    },
  })

  notifyCircleMembers(data.circleId, data.requestedById, {
    type: "CONTRIBUTION_REMINDER",
    title: `Approval needed: ${data.title}`,
    message: `A new ${data.type.toLowerCase().replace(/_/g, " ")} request requires your review.`,
    link: `/circles/${data.circleId}/approvals`,
  }).catch(console.error)

  return request
}

// ─── 2. Approve Request ───────────────────────────────────

export async function approveRequest(data: {
  approvalRequestId: string
  reviewerId: string
  comment?: string | null
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: data.approvalRequestId },
    include: { circle: { select: { id: true } } },
  })
  if (!request) throw new Error("Approval request not found")
  if (request.status !== "PENDING") throw new Error("Approval request is not pending")

  if (request.expiresAt && new Date() > request.expiresAt) {
    throw new Error("Approval request has expired")
  }

  if (request.requestedById === data.reviewerId) {
    throw new Error("Cannot approve your own request")
  }

  const reviewPerm = REVIEW_PERMISSION_MAP[request.type]
  await requireCirclePermission({ userId: data.reviewerId, circleId: request.circleId, permission: reviewPerm as any })

  const result = await prisma.$transaction(async (tx) => {
    const existingDecision = await tx.approvalRequestDecision.findUnique({
      where: { approvalRequestId_reviewerId: { approvalRequestId: request.id, reviewerId: data.reviewerId } },
    })
    if (existingDecision) throw new Error("You have already voted on this request")

    const decision = await tx.approvalRequestDecision.create({
      data: {
        approvalRequestId: request.id,
        reviewerId: data.reviewerId,
        decision: "APPROVE" as ApprovalDecision,
        comment: data.comment || null,
      },
    })

    const newCount = request.currentApprovals + 1
    const reachedMinimum = newCount >= request.minimumApprovals

    const updatedRequest = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        currentApprovals: newCount,
        ...(reachedMinimum && {
          status: "APPROVED" as ApprovalStatus,
          completedAt: new Date(),
          approvedAt: new Date(),
        }),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        decisions: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: data.reviewerId,
        circleId: request.circleId,
        action: "APPROVED",
        entityType: "ApprovalRequest",
        entityId: request.id,
        newValues: { decision: "APPROVE", comment: data.comment, currentApprovals: newCount, reachedMinimum },
      },
    })

    return { decision, request: updatedRequest, reachedMinimum }
  })

  if (result.reachedMinimum) {
    createNotification({
      userId: request.requestedById,
      circleId: request.circleId,
      type: "CONTRIBUTION_MADE",
      title: `Approved: ${request.title}`,
      message: `Your request has received enough approvals and is now approved.`,
      link: `/circles/${request.circleId}/approvals`,
    }).catch(console.error)
  }

  return result
}

// ─── 3. Reject Request ────────────────────────────────────

export async function rejectRequest(data: {
  approvalRequestId: string
  reviewerId: string
  comment?: string | null
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: data.approvalRequestId },
    include: { circle: { select: { id: true } } },
  })
  if (!request) throw new Error("Approval request not found")
  if (request.status !== "PENDING") throw new Error("Approval request is not pending")

  if (request.requestedById === data.reviewerId) {
    throw new Error("Cannot reject your own request")
  }

  const rejectPerm = REJECT_PERMISSION_MAP[request.type]
  await requireCirclePermission({ userId: data.reviewerId, circleId: request.circleId, permission: rejectPerm as any })

  const result = await prisma.$transaction(async (tx) => {
    const existingDecision = await tx.approvalRequestDecision.findUnique({
      where: { approvalRequestId_reviewerId: { approvalRequestId: request.id, reviewerId: data.reviewerId } },
    })
    if (existingDecision) throw new Error("You have already voted on this request")

    const decision = await tx.approvalRequestDecision.create({
      data: {
        approvalRequestId: request.id,
        reviewerId: data.reviewerId,
        decision: "REJECT" as ApprovalDecision,
        comment: data.comment || null,
      },
    })

    const updatedRequest = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED" as ApprovalStatus,
        rejectedAt: new Date(),
        completedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        decisions: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: data.reviewerId,
        circleId: request.circleId,
        action: "REJECTED",
        entityType: "ApprovalRequest",
        entityId: request.id,
        newValues: { decision: "REJECT", comment: data.comment },
      },
    })

    return { decision, request: updatedRequest }
  })

  createNotification({
    userId: request.requestedById,
    circleId: request.circleId,
    type: "SETTLEMENT_REJECTED",
    title: `Rejected: ${request.title}`,
    message: `Your request has been rejected.`,
    link: `/circles/${request.circleId}/approvals`,
  }).catch(console.error)

  return result
}

// ─── 4. Cancel Request ────────────────────────────────────

export async function cancelRequest(data: {
  approvalRequestId: string
  userId: string
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: data.approvalRequestId },
  })
  if (!request) throw new Error("Approval request not found")
  if (request.status !== "PENDING") throw new Error("Approval request is not pending")

  const isRequester = request.requestedById === data.userId
  if (!isRequester) {
    const memberPerms = await getCircleMemberPermissions({ userId: data.userId, circleId: request.circleId })
    const isOwner = memberPerms?.role === "OWNER"
    if (!isOwner) throw new Error("Only the requester or circle owner can cancel")
  }

  const oldStatus = request.status

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELLED" as ApprovalStatus,
        completedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        decisions: {
          include: {
            reviewer: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: data.userId,
        circleId: request.circleId,
        action: "CANCELLED",
        entityType: "ApprovalRequest",
        entityId: request.id,
        oldValues: { status: oldStatus },
        newValues: { status: "CANCELLED" },
      },
    })

    return updated
  })

  return updatedRequest
}

// ─── 5. Expire Request ────────────────────────────────────

export async function expireRequest(approvalRequestId: string) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
  })
  if (!request) throw new Error("Approval request not found")
  if (request.status !== "PENDING") return request

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.update({
      where: { id: approvalRequestId },
      data: {
        status: "EXPIRED" as ApprovalStatus,
        completedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: request.requestedById,
        circleId: request.circleId,
        action: "EXPIRED",
        entityType: "ApprovalRequest",
        entityId: approvalRequestId,
        oldValues: { status: "PENDING" },
        newValues: { status: "EXPIRED" },
      },
    })

    return updated
  })

  return updatedRequest
}

// ─── 6. Get Pending Approvals ─────────────────────────────

export async function getPendingApprovals(
  circleId: string,
  filters?: { type?: ApprovalType; search?: string }
) {
  const where: Record<string, unknown> = {
    circleId,
    status: "PENDING",
  }

  if (filters?.type) {
    where.type = filters.type
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  const requests = await prisma.approvalRequest.findMany({
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
  })

  return requests.map((r) => ({
    ...r,
    amount: r.amount ? Number(r.amount) : null,
    isExpired: r.expiresAt ? new Date() > r.expiresAt : false,
    approvalsNeeded: r.minimumApprovals - r.currentApprovals,
  }))
}

// ─── 7. Get Approval Stats ────────────────────────────────

export async function getApprovalStats(circleId: string) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [pending, approvedToday, rejectedToday, overdue] = await Promise.all([
    prisma.approvalRequest.count({
      where: { circleId, status: "PENDING" },
    }),
    prisma.approvalRequest.count({
      where: {
        circleId,
        status: "APPROVED",
        approvedAt: { gte: startOfDay },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        circleId,
        status: "REJECTED",
        rejectedAt: { gte: startOfDay },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        circleId,
        status: "PENDING",
        expiresAt: { lt: now },
      },
    }),
  ])

  return { pending, approvedToday, rejectedToday, overdue }
}

// ─── 8. Get Approval Timeline ─────────────────────────────

export async function getApprovalTimeline(approvalRequestId: string) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, image: true } },
      decisions: {
        include: {
          reviewer: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!request) throw new Error("Approval request not found")

  const events: Array<{
    type: string
    user: { id: string; name: string | null; email: string; image: string | null } | null
    timestamp: Date
    comment: string | null
    metadata?: Record<string, unknown>
  }> = []

  events.push({
    type: "REQUESTED",
    user: request.requestedBy,
    timestamp: request.requestedAt,
    comment: null,
    metadata: { title: request.title, type: request.type, minimumApprovals: request.minimumApprovals },
  })

  for (const decision of request.decisions) {
    events.push({
      type: decision.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      user: decision.reviewer,
      timestamp: decision.createdAt,
      comment: decision.comment,
    })
  }

  if (request.status === "APPROVED" && request.completedAt) {
    events.push({
      type: "COMPLETED",
      user: null,
      timestamp: request.completedAt,
      comment: null,
      metadata: { status: "APPROVED", totalApprovals: request.currentApprovals },
    })
  }

  if (request.status === "CANCELLED" && request.completedAt) {
    events.push({
      type: "CANCELLED",
      user: request.requestedBy,
      timestamp: request.completedAt,
      comment: null,
    })
  }

  if (request.status === "EXPIRED" && request.completedAt) {
    events.push({
      type: "EXPIRED",
      user: null,
      timestamp: request.completedAt,
      comment: null,
    })
  }

  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  return {
    request: {
      ...request,
      amount: request.amount ? Number(request.amount) : null,
    },
    events,
  }
}

// ─── 9. Get Approval History ──────────────────────────────

export async function getApprovalHistory(
  circleId: string,
  filters?: {
    type?: ApprovalType
    status?: ApprovalStatus
    search?: string
    limit?: number
    offset?: number
  }
) {
  const limit = filters?.limit ?? 20
  const offset = filters?.offset ?? 0

  const where: Record<string, unknown> = { circleId }

  if (filters?.type) {
    where.type = filters.type
  }

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: where as any,
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        decisions: {
          include: {
            reviewer: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.approvalRequest.count({ where: where as any }),
  ])

  return {
    requests: requests.map((r) => ({
      ...r,
      amount: r.amount ? Number(r.amount) : null,
    })),
    total,
    hasMore: offset + limit < total,
  }
}

// ─── 10. Expire Stale Approvals ───────────────────────────

export async function expireStaleApprovals(circleId?: string) {
  const now = new Date()

  const where: Record<string, unknown> = {
    status: "PENDING",
    expiresAt: { lt: now },
  }

  if (circleId) {
    where.circleId = circleId
  }

  const staleRequests = await prisma.approvalRequest.findMany({
    where: where as any,
    select: { id: true, circleId: true, title: true, requestedById: true },
  })

  if (staleRequests.length === 0) return { expiredCount: 0 }

  let expiredCount = 0

  for (const req of staleRequests) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.approvalRequest.update({
          where: { id: req.id },
          data: {
            status: "EXPIRED" as ApprovalStatus,
            completedAt: now,
          },
        })

        await tx.auditLog.create({
          data: {
            userId: req.requestedById,
            circleId: req.circleId,
            action: "EXPIRED",
            entityType: "ApprovalRequest",
            entityId: req.id,
            oldValues: { status: "PENDING" },
            newValues: { status: "EXPIRED", reason: "expired_by_system" },
          },
        })
      })

      createNotification({
        userId: req.requestedById,
        circleId: req.circleId,
        type: "CONTRIBUTION_REMINDER",
        title: `Expired: ${req.title}`,
        message: `Your approval request has expired without reaching the required approvals.`,
        link: `/circles/${req.circleId}/approvals`,
      }).catch(console.error)

      expiredCount++
    } catch (err) {
      console.error(`Failed to expire approval request ${req.id}:`, err)
    }
  }

  return { expiredCount }
}
