import { prisma } from "@/lib/prisma"
import type { ContributionFrequency, ContributionStatus } from "@/generated/prisma"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import { createAuditLog } from "@/lib/services/audit.service"
import { recordContributionToLedger, reverseContributionLedger } from "@/lib/services/wallet.service"
import { createSystemPost } from "@/lib/services/feed.service"
import { markCircleStale, markDashboardStale } from "@/lib/services/snapshot.service"

async function getMemberRole(
  circleId: string,
  userId: string
): Promise<string | null> {
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
    select: { role: true },
  })
  return member?.role ?? null
}

async function requireMemberRole(
  circleId: string,
  userId: string,
  allowedRoles: string[]
): Promise<string> {
  const role = await getMemberRole(circleId, userId)
  if (!role) throw new Error("Not a member of this circle")
  if (!allowedRoles.includes(role)) throw new Error("Insufficient permissions")
  return role
}

// ─── Contribution Plans ──────────────────────────────────

export async function getContributionPlans(circleId: string, userId: string) {
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

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
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN"])

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
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN"])

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
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN"])

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
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

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
  const role = await requireMemberRole(circleId, actorUserId, [
    "OWNER",
    "ADMIN",
    "MEMBER",
  ])

  // Members can only record their own contributions
  if (role === "MEMBER" && data.userId !== actorUserId) {
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
  data: { amount?: number; status?: string; paymentDate?: string; note?: string | null }
) {
  await requireMemberRole(circleId, actorUserId, ["OWNER", "ADMIN"])

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }

  const updated = await prisma.contribution.update({
    where: { id: contributionId },
    data: {
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.status !== undefined && { status: data.status as ContributionStatus }),
      ...(data.paymentDate !== undefined && {
        paymentDate: new Date(data.paymentDate),
      }),
      ...(data.note !== undefined && { note: data.note }),
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      plan: { select: { id: true, name: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
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
  await requireMemberRole(circleId, actorUserId, ["OWNER", "ADMIN"])

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
  })
  if (!contribution || contribution.circleId !== circleId) {
    throw new Error("Contribution not found")
  }

  await prisma.contribution.update({ where: { id: contributionId }, data: { deletedAt: new Date() } })
  await createAuditLog({ userId: actorUserId, circleId, action: "SOFT_DELETE", entityType: "Contribution", entityId: contributionId })

  // Reverse wallet ledger entry (fire-and-forget)
  reverseContributionLedger(circleId, contributionId, Number(contribution.amount), actorUserId).catch(console.error)

  return { success: true }
}

// ─── Summary ─────────────────────────────────────────────

export async function getContributionSummary(circleId: string, userId: string) {
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

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
