import { prisma } from "@/lib/prisma"
import type { ContributionFrequency, ContributionStatus } from "@/generated/prisma"
import { notifyCircleMembers, createBulkNotifications } from "@/lib/services/notification.service"
import { createAuditLog } from "@/lib/services/audit.service"
import { recordContributionToLedger, reverseContributionLedger } from "@/lib/services/wallet.service"
import { createSystemPost } from "@/lib/services/feed.service"
import { markCircleStale } from "@/lib/services/snapshot.service"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createApprovalRequest, getApprovalConfig, getCircleReviewers } from "@/lib/services/approval.service"
import { createReceiptForContribution } from "@/lib/services/receipt.service"

// ─── Contribution Plans ──────────────────────────────────

export async function getContributionPlans(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL })

  const plans = await prisma.contributionPlan.findMany({
    where: { circleId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { contributions: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return plans.map((p) => ({
    ...p,
    amount: Number(p.amount),
    totalContributions: p._count.contributions,
  }))
}

export async function createContributionPlan(
  circleId: string,
  userId: string,
  data: {
    name: string
    description?: string | null
    amount: number
    frequency: string
    dueDay?: number | null
    startDate: string
    endDate?: string | null
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE })

  const plan = await prisma.contributionPlan.create({
    data: {
      circleId,
      name: data.name,
      description: data.description || null,
      amount: data.amount,
      frequency: data.frequency as ContributionFrequency,
      dueDay: data.dueDay || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdById: userId,
    },
  })

  notifyCircleMembers(circleId, userId, {
    type: "CONTRIBUTION_PLAN_CREATED",
    title: `New plan: ${data.name}`,
    message: `A contribution plan "${data.name}" was created — ${data.frequency} at ${data.amount}`,
    link: `/circles/${circleId}/contributions`,
  })

  markCircleStale(circleId).catch(console.error)

  return { ...plan, amount: Number(plan.amount) }
}

export async function updateContributionPlan(
  circleId: string,
  planId: string,
  userId: string,
  data: {
    name?: string
    description?: string | null
    amount?: number
    frequency?: string
    dueDay?: number | null
    startDate?: string
    endDate?: string | null
    isActive?: boolean
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE })

  const plan = await prisma.contributionPlan.findUnique({
    where: { id: planId },
  })
  if (!plan || plan.circleId !== circleId) {
    throw new Error("Plan not found")
  }

  const updated = await prisma.contributionPlan.update({
    where: { id: planId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.frequency !== undefined && { frequency: data.frequency as ContributionFrequency }),
      ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })

  return { ...updated, amount: Number(updated.amount) }
}

export async function deleteContributionPlan(
  circleId: string,
  planId: string,
  userId: string
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW })

  const plan = await prisma.contributionPlan.findUnique({
    where: { id: planId },
  })
  if (!plan || plan.circleId !== circleId) {
    throw new Error("Plan not found")
  }

  await prisma.contributionPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "SOFT_DELETE", entityType: "ContributionPlan", entityId: planId })
  return { success: true }
}

// ─── Contributions ───────────────────────────────────────

export async function getContributions(
  circleId: string,
  userId: string,
  filters?: { userId?: string; planId?: string; status?: string }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL })

  const where: Record<string, string> = {}
  if (filters?.userId) where.userId = filters.userId
  if (filters?.planId) where.planId = filters.planId
  if (filters?.status) where.status = filters.status

  const contributions = await prisma.contribution.findMany({
    where: { ...where, circleId, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { paymentDate: "desc" },
  })

  return contributions.map((c) => ({
    ...c,
    amount: Number(c.amount),
    plan: c.plan ? { ...c.plan, amount: Number(c.plan.amount) } : null,
  }))
}

export async function addContribution(
  circleId: string,
  actorUserId: string,
  data: {
    userId: string
    planId?: string | null
    amount: number
    status: string
    paymentDate: string
    note?: string | null
  }
) {
  await requireCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN })

  // Members can only record their own contributions
  const hasCreate = await hasCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE })
  if (!hasCreate && data.userId !== actorUserId) {
    throw new Error("Members can only record their own contributions")
  }

  // Verify the contributing user is a circle member
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: data.userId } },
  })
  if (!member) throw new Error("User is not a member of this circle")

  // Verify plan belongs to this circle if provided
  if (data.planId) {
    const plan = await prisma.contributionPlan.findUnique({
      where: { id: data.planId },
    })
    if (!plan || plan.circleId !== circleId) {
      throw new Error("Plan not found in this circle")
    }
  }

  // Check if approval is required for contributions
  const approvalConfig = await getApprovalConfig(circleId)
  const approvalEnabled = approvalConfig.contribution?.enabled ?? false

  if (approvalEnabled) {
    // Approval flow: create as PENDING_REVIEW, no ledger, no system post yet
    const contribution = await prisma.contribution.create({
      data: {
        circleId,
        userId: data.userId,
        planId: data.planId || null,
        amount: data.amount,
        status: "PENDING_REVIEW",
        paymentDate: new Date(data.paymentDate),
        note: data.note || null,
        createdById: actorUserId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        plan: { select: { id: true, name: true, amount: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Create approval request
    const approvalRequest = await createApprovalRequest({
      circleId,
      type: "CONTRIBUTION",
      requestedById: actorUserId,
      title: `Contribution of ${data.amount} from ${contribution.user.name || contribution.user.email}`,
      description: data.note || null,
      resourceId: contribution.id,
      amount: data.amount,
      metadata: {
        contributionId: contribution.id,
        userId: data.userId,
        planId: data.planId || null,
      },
    })

    // Link approval request to contribution
    await prisma.contribution.update({
      where: { id: contribution.id },
      data: { approvalRequestId: approvalRequest.id },
    })

    // Notify reviewers only (fire-and-forget)
    getCircleReviewers(circleId)
      .then((reviewerIds) => {
        const reviewerNotifications = reviewerIds
          .filter((id) => id !== actorUserId)
          .map((userId) => ({
            userId,
            circleId,
            type: "CONTRIBUTION_MADE" as const,
            title: "Contribution pending review",
            message: `A contribution of ${data.amount} is awaiting your approval`,
            link: `/circles/${circleId}/contributions`,
          }))
        return createBulkNotifications(reviewerNotifications)
      })
      .catch(console.error)

    return {
      ...contribution,
      amount: Number(contribution.amount),
      plan: contribution.plan ? { ...contribution.plan, amount: Number(contribution.plan.amount) } : null,
    }
  }

  // Standard flow: no approval required
  const contribution = await prisma.contribution.create({
    data: {
      circleId,
      userId: data.userId,
      planId: data.planId || null,
      amount: data.amount,
      status: data.status as ContributionStatus,
      paymentDate: new Date(data.paymentDate),
      note: data.note || null,
      createdById: actorUserId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const contributor = contribution.user.name || contribution.user.email
  notifyCircleMembers(circleId, actorUserId, {
    type: "CONTRIBUTION_MADE",
    title: `${contributor} contributed`,
    message: `${contributor} recorded a contribution of ${data.amount}`,
    link: `/circles/${circleId}/contributions`,
  })

  // Record to wallet ledger (fire-and-forget)
  recordContributionToLedger(circleId, contribution.id, data.amount, actorUserId).catch(console.error)

  // Auto system post
  createSystemPost(circleId, { type: "CONTRIBUTION", content: `${contributor} contributed ${data.amount}` }).catch(console.error)

  return {
    ...contribution,
    amount: Number(contribution.amount),
    plan: contribution.plan ? { ...contribution.plan, amount: Number(contribution.plan.amount) } : null,
  }
}

export async function updateContribution(
  circleId: string,
  contributionId: string,
  actorUserId: string,
  data: { amount?: number; status?: string; paymentDate?: string; note?: string | null; planId?: string | null }
) {
  await requireCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW })

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      approvalRequest: { select: { id: true, status: true } },
    },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }
  if (contribution.deletedAt) {
    throw new Error("Cannot edit a deleted contribution")
  }

  const oldAmount = Number(contribution.amount)
  const oldValues = {
    amount: oldAmount,
    status: contribution.status,
    paymentDate: contribution.paymentDate.toISOString(),
    note: contribution.note,
    planId: contribution.planId,
  }

  const updateData: Record<string, unknown> = {}
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.status !== undefined) updateData.status = data.status as ContributionStatus
  if (data.paymentDate !== undefined) updateData.paymentDate = new Date(data.paymentDate)
  if (data.note !== undefined) updateData.note = data.note
  if (data.planId !== undefined) updateData.planId = data.planId

  // For CONFIRMED or REJECTED contributions, only allow note/planId changes
  if (contribution.status === "CONFIRMED" || contribution.status === "REJECTED") {
    if (data.amount !== undefined || data.status !== undefined || data.paymentDate !== undefined) {
      throw new Error("Cannot change amount, status, or date on a confirmed/rejected contribution. Void it first.")
    }
  }

  const updated = await prisma.contribution.update({
    where: { id: contributionId },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  // If amount changed for a PAID contribution, reverse old ledger and record new one
  if (data.amount !== undefined && Number(data.amount) !== oldAmount && contribution.status === "PAID") {
    reverseContributionLedger(circleId, contributionId, oldAmount, actorUserId).catch(console.error)
    recordContributionToLedger(circleId, contributionId, Number(data.amount), actorUserId).catch(console.error)

    // Void any existing receipt and create a new one
    prisma.financialReceipt
      .updateMany({
        where: { resourceId: contributionId, resourceType: "CONTRIBUTION", status: "ACTIVE" },
        data: { status: "REPLACED", voidedAt: new Date(), voidedByUserId: actorUserId, voidReason: "Amount changed via edit" },
      })
      .catch(console.error)
  }

  await createAuditLog({
    userId: actorUserId,
    circleId,
    action: "UPDATE",
    entityType: "Contribution",
    entityId: contributionId,
    oldValues,
    newValues: {
      amount: Number(updated.amount),
      status: updated.status,
      paymentDate: updated.paymentDate.toISOString(),
      note: updated.note,
      planId: updated.planId,
    },
  })

  return {
    ...updated,
    amount: Number(updated.amount),
    plan: updated.plan ? { ...updated.plan, amount: Number(updated.plan.amount) } : null,
  }
}

export async function deleteContribution(
  circleId: string,
  contributionId: string,
  actorUserId: string
) {
  await requireCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW })

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      approvalRequest: { select: { id: true, status: true } },
    },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }
  if (contribution.deletedAt) {
    throw new Error("Contribution is already deleted")
  }

  // Void any active receipts
  await prisma.financialReceipt.updateMany({
    where: { resourceId: contributionId, resourceType: "CONTRIBUTION", status: "ACTIVE" },
    data: { status: "VOIDED", voidedAt: new Date(), voidedByUserId: actorUserId, voidReason: "Contribution voided" },
  })

  // Cancel pending approval request if one exists
  if (contribution.approvalRequest?.status === "PENDING") {
    await prisma.approvalRequest.update({
      where: { id: contribution.approvalRequest.id },
      data: { status: "CANCELLED" },
    })
  }

  // Soft-delete the contribution
  await prisma.contribution.update({
    where: { id: contributionId },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  })

  await createAuditLog({
    userId: actorUserId,
    circleId,
    action: "SOFT_DELETE",
    entityType: "Contribution",
    entityId: contributionId,
    oldValues: { status: contribution.status, amount: Number(contribution.amount) },
  })

  // Reverse wallet ledger entry (fire-and-forget)
  if (contribution.status === "PAID" || contribution.status === "CONFIRMED") {
    reverseContributionLedger(circleId, contributionId, Number(contribution.amount), actorUserId).catch(console.error)
  }

  return { success: true }
}

export async function restoreContribution(
  circleId: string,
  contributionId: string,
  actorUserId: string
) {
  await requireCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW })

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }
  if (!contribution.deletedAt) {
    throw new Error("Contribution is not deleted")
  }

  const restored = await prisma.contribution.update({
    where: { id: contributionId },
    data: { deletedAt: null, status: "PAID" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await createAuditLog({
    userId: actorUserId,
    circleId,
    action: "RESTORE",
    entityType: "Contribution",
    entityId: contributionId,
    oldValues: { deletedAt: contribution.deletedAt.toISOString(), status: contribution.status },
    newValues: { deletedAt: null, status: "PAID" },
  })

  return {
    ...restored,
    amount: Number(restored.amount),
    plan: restored.plan ? { ...restored.plan, amount: Number(restored.plan.amount) } : null,
  }
}

export async function getDeletedContributions(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW })

  const contributions = await prisma.contribution.findMany({
    where: { circleId, deletedAt: { not: null } },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { deletedAt: "desc" },
  })

  return contributions.map((c) => ({
    ...c,
    amount: Number(c.amount),
    plan: c.plan ? { ...c.plan, amount: Number(c.plan.amount) } : null,
    deletedAt: c.deletedAt?.toISOString() ?? null,
  }))
}

// ─── Summary ─────────────────────────────────────────────

export async function confirmContribution(
  circleId: string,
  contributionId: string,
  reviewerId: string
) {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }
  if (contribution.status !== "PENDING_REVIEW") {
    throw new Error("Contribution is not pending review")
  }

  const updated = await prisma.contribution.update({
    where: { id: contributionId },
    data: { status: "CONFIRMED" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const ledgerTx = await recordContributionToLedger(circleId, contributionId, Number(contribution.amount), reviewerId)

  const contributor = contribution.user.name || contribution.user.email

  // Create receipt if one doesn't already exist (idempotent)
  const existingReceipt = await prisma.financialReceipt.findFirst({
    where: { resourceId: contributionId, resourceType: "CONTRIBUTION" },
  })

  if (!existingReceipt) {
    try {
      const circle = await prisma.circle.findUnique({
        where: { id: circleId },
        select: { id: true, name: true, currency: true },
      })

      if (circle && ledgerTx) {
        const circleCode = circle.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 10)
          .toUpperCase()

        await createReceiptForContribution({
          circleId,
          contributionId,
          ledgerEntryId: ledgerTx.id,
          circleName: circle.name,
          circleCode,
          payerUserId: contribution.userId,
          payerName: contribution.user.name || contribution.user.email,
          payerEmail: contribution.user.email,
          amount: Number(contribution.amount),
          currency: circle.currency,
          paymentDate: contribution.paymentDate,
          approvalDate: new Date(),
          planName: contribution.plan?.name ?? null,
          approverNames: reviewerId,
          issuedByUserId: reviewerId,
        })
      }
    } catch {
      // Receipt creation is non-critical; don't fail the contribution confirmation
    }
  }

  // System post (fire-and-forget)
  createSystemPost(circleId, { type: "CONTRIBUTION", content: `${contributor} contributed ${contribution.amount}` }).catch(console.error)

  // Notify the contributor
  createBulkNotifications([{
    userId: contribution.userId,
    circleId,
    type: "CONTRIBUTION_MADE",
    title: "Contribution confirmed",
    message: `Your contribution of ${contribution.amount} has been confirmed`,
    link: `/circles/${circleId}/contributions`,
  }]).catch(console.error)

  return {
    ...updated,
    amount: Number(updated.amount),
    plan: updated.plan ? { ...updated.plan, amount: Number(updated.plan.amount) } : null,
  }
}

export async function rejectContribution(
  circleId: string,
  contributionId: string,
  reviewerId: string,
  reason?: string | null
) {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }
  if (contribution.status !== "PENDING_REVIEW") {
    throw new Error("Contribution is not pending review")
  }

  const updated = await prisma.contribution.update({
    where: { id: contributionId },
    data: { status: "REJECTED" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  // Notify the contributor with reason
  createBulkNotifications([{
    userId: contribution.userId,
    circleId,
    type: "CONTRIBUTION_MADE",
    title: "Contribution rejected",
    message: reason
      ? `Your contribution of ${contribution.amount} was rejected: ${reason}`
      : `Your contribution of ${contribution.amount} was rejected`,
    link: `/circles/${circleId}/contributions`,
  }]).catch(console.error)

  return {
    ...updated,
    amount: Number(updated.amount),
    plan: updated.plan ? { ...updated.plan, amount: Number(updated.plan.amount) } : null,
  }
}

// ─── Summary ─────────────────────────────────────────────

export async function getContributionSummary(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL })

  const [totalPaid, totalPending, plans, memberSummaries] = await Promise.all([
    prisma.contribution.aggregate({
      where: { circleId, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.contribution.aggregate({
      where: { circleId, status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.contributionPlan.findMany({
      where: { circleId, isActive: true },
      select: { amount: true, frequency: true },
    }),
    prisma.circleMember.findMany({
      where: { circleId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ])

  const totalExpected = plans.reduce((sum, p) => sum + Number(p.amount), 0)
  const paid = Number(totalPaid._sum.amount ?? 0)
  const pending = Number(totalPending._sum.amount ?? 0)

  const memberIds = memberSummaries.map((m) => m.userId)
  const [paidByUser, pendingByUser] = await Promise.all([
    prisma.contribution.groupBy({ by: ["userId"], where: { circleId, userId: { in: memberIds }, status: "PAID" }, _sum: { amount: true } }),
    prisma.contribution.groupBy({ by: ["userId"], where: { circleId, userId: { in: memberIds }, status: "PENDING" }, _sum: { amount: true } }),
  ])

  const membersWithStats = memberSummaries.map((m) => {
    const p = paidByUser.find((x) => x.userId === m.userId)
    const pe = pendingByUser.find((x) => x.userId === m.userId)
    return {
      userId: m.userId,
      user: m.user,
      role: m.role,
      totalPaid: Number(p?._sum.amount ?? 0),
      totalPending: Number(pe?._sum.amount ?? 0),
    }
  })

  return {
    totalPaid: paid,
    totalPending: pending,
    totalExpected,
    outstanding: totalExpected - paid,
    overdue: pending, // pending = overdue for now
    memberCount: memberSummaries.length,
    members: membersWithStats,
  }
}
