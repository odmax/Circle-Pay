import { prisma } from "@/lib/prisma"
import type { ApprovalType, ApprovalDelegationStatus } from "@/generated/prisma"
import { requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification } from "@/lib/services/notification.service"

// ─── 1. Create Delegation ───────────────────────────────

export async function createDelegation(data: {
  circleId: string
  delegatorMemberId: string
  delegateMemberId: string
  approvalType?: ApprovalType | null
  workflowId?: string | null
  stageId?: string | null
  startsAt?: Date | null
  endsAt: Date
  reason?: string | null
  createdById: string
}) {
  // Verify both users are members
  const [delegator, delegate] = await Promise.all([
    prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId: data.circleId, userId: data.delegatorMemberId } },
    }),
    prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId: data.circleId, userId: data.delegateMemberId } },
    }),
  ])

  if (!delegator) throw new Error("Delegator is not a circle member")
  if (!delegate) throw new Error("Delegate is not a circle member")
  if (data.delegatorMemberId === data.delegateMemberId) throw new Error("Cannot delegate to yourself")
  if (data.endsAt <= new Date()) throw new Error("Delegation end date must be in the future")

  // Check for cycle: delegate -> delegator delegation
  const existingDelegation = await prisma.approvalDelegation.findFirst({
    where: {
      circleId: data.circleId,
      delegatorMemberId: data.delegateMemberId,
      delegateMemberId: data.delegatorMemberId,
      status: "ACTIVE",
    },
  })
  if (existingDelegation) throw new Error("Circular delegation detected")

  // Check for conflicting active delegation (same type/scope)
  const conflicting = await prisma.approvalDelegation.findFirst({
    where: {
      circleId: data.circleId,
      delegatorMemberId: data.delegatorMemberId,
      delegateMemberId: data.delegateMemberId,
      status: "ACTIVE",
      approvalType: data.approvalType ?? undefined,
      startsAt: { lte: data.endsAt },
      endsAt: { gte: data.startsAt ?? new Date() },
    },
  })
  if (conflicting) throw new Error("A delegation with the same scope already exists")

  // Check permission
  const isSelf = data.delegatorMemberId === data.createdById
  if (!isSelf) {
    await requireCirclePermission({ userId: data.createdById, circleId: data.circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_DELEGATE })
  }

  const delegation = await prisma.approvalDelegation.create({
    data: {
      circleId: data.circleId,
      delegatorMemberId: data.delegatorMemberId,
      delegateMemberId: data.delegateMemberId,
      approvalType: data.approvalType || null,
      workflowId: data.workflowId || null,
      stageId: data.stageId || null,
      startsAt: data.startsAt || new Date(),
      endsAt: data.endsAt,
      status: "ACTIVE",
      reason: data.reason || null,
    },
  })

  await createAuditLog({
    userId: data.createdById,
    circleId: data.circleId,
    action: "CREATED",
    entityType: "ApprovalDelegation",
    entityId: delegation.id,
    newValues: {
      delegator: data.delegatorMemberId,
      delegate: data.delegateMemberId,
      approvalType: data.approvalType,
      endsAt: data.endsAt,
    },
  })

  createNotification({
    userId: data.delegateMemberId,
    circleId: data.circleId,
    type: "APPROVAL_DELEGATED",
    title: "Approval delegation assigned",
    message: `You have been delegated approval authority.${data.reason ? ` Reason: ${data.reason}` : ""}`,
    link: `/circles/${data.circleId}/approvals`,
  }).catch(console.error)

  return delegation
}

// ─── 2. Revoke Delegation ───────────────────────────────

export async function revokeDelegation(data: {
  delegationId: string
  userId: string
}) {
  const delegation = await prisma.approvalDelegation.findUnique({
    where: { id: data.delegationId },
  })
  if (!delegation) throw new Error("Delegation not found")
  if (delegation.status !== "ACTIVE") throw new Error("Delegation is not active")

  const isDelegator = delegation.delegatorMemberId === data.userId
  if (!isDelegator) {
    await requireCirclePermission({ userId: data.userId, circleId: delegation.circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_DELEGATE })
  }

  const updated = await prisma.approvalDelegation.update({
    where: { id: data.delegationId },
    data: { status: "REVOKED" },
  })

  await createAuditLog({
    userId: data.userId,
    circleId: delegation.circleId,
    action: "REVOKED",
    entityType: "ApprovalDelegation",
    entityId: data.delegationId,
    oldValues: { status: "ACTIVE" },
    newValues: { status: "REVOKED" },
  })

  return updated
}

// ─── 3. Get Active Delegations ──────────────────────────

export async function getActiveDelegations(circleId: string, memberId?: string) {
  const where: Record<string, unknown> = {
    circleId,
    status: "ACTIVE",
    startsAt: { lte: new Date() },
    endsAt: { gte: new Date() },
  }

  if (memberId) {
    where.OR = [
      { delegatorMemberId: memberId },
      { delegateMemberId: memberId },
    ]
  }

  return prisma.approvalDelegation.findMany({
    where: where as any,
    include: {
      circle: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

// ─── 4. Find Delegate for Member ────────────────────────

export async function findDelegateForMember(params: {
  circleId: string
  memberId: string
  approvalType?: ApprovalType
}) {
  const { circleId, memberId, approvalType } = params

  const where: Record<string, unknown> = {
    circleId,
    delegatorMemberId: memberId,
    status: "ACTIVE",
    startsAt: { lte: new Date() },
    endsAt: { gte: new Date() },
  }

  if (approvalType) {
    where.OR = [
      { approvalType },
      { approvalType: null },
    ]
  }

  return prisma.approvalDelegation.findFirst({
    where: where as any,
    orderBy: [{ approvalType: "desc" }, { endsAt: "asc" }],
  })
}

// ─── 5. Expire Stale Delegations ────────────────────────

export async function expireStaleDelegations() {
  const now = new Date()

  const expired = await prisma.approvalDelegation.updateMany({
    where: {
      status: "ACTIVE",
      endsAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  })

  return { expiredCount: expired.count }
}
