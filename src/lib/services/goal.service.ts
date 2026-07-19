import { prisma } from "@/lib/prisma"
import type { GoalStatus } from "@/generated/prisma"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import { createAuditLog } from "@/lib/services/audit.service"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

// ─── Goals ────────────────────────────────────────────────

export async function getGoals(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })

  const goals = await prisma.goal.findMany({
    where: { circleId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { allocations: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return goals.map((g) => ({
    ...g,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    allocationCount: g._count.allocations,
    progress:
      Number(g.targetAmount) > 0
        ? Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100))
        : 0,
  }))
}

export async function createGoal(
  circleId: string,
  userId: string,
  data: { name: string; description?: string | null; targetAmount: number; deadline?: string | null }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOAL_CREATE })

  const goal = await prisma.goal.create({
    data: {
      circleId,
      name: data.name,
      description: data.description || null,
      targetAmount: data.targetAmount,
      deadline: data.deadline ? new Date(data.deadline) : null,
      createdById: userId,
    },
  })

  notifyCircleMembers(circleId, userId, {
    type: "GOAL_CREATED",
    title: `New goal: ${goal.name}`,
    message: `A savings goal "${goal.name}" was created with a target of ${data.targetAmount}`,
    link: `/circles/${circleId}/goals`,
  })

  return { ...goal, targetAmount: Number(goal.targetAmount), currentAmount: Number(goal.currentAmount) }
}

export async function updateGoal(
  circleId: string,
  goalId: string,
  userId: string,
  data: {
    name?: string; description?: string | null; targetAmount?: number
    deadline?: string | null; status?: string
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOAL_UPDATE })

  const goal = await prisma.goal.findUnique({ where: { id: goalId, deletedAt: null } })
  if (!goal || goal.circleId !== circleId) throw new Error("Goal not found")

  const updated = await prisma.goal.update({
    where: { id: goalId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
      ...(data.deadline !== undefined && { deadline: data.deadline ? new Date(data.deadline) : null }),
      ...(data.status !== undefined && { status: data.status as GoalStatus }),
    },
  })

  return { ...updated, targetAmount: Number(updated.targetAmount), currentAmount: Number(updated.currentAmount) }
}

export async function deleteGoal(circleId: string, goalId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOAL_DELETE })
  const goal = await prisma.goal.findUnique({ where: { id: goalId, deletedAt: null } })
  if (!goal || goal.circleId !== circleId) throw new Error("Goal not found")
  await prisma.goal.update({ where: { id: goalId }, data: { deletedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "SOFT_DELETE", entityType: "Goal", entityId: goalId })
  return { success: true }
}

// ─── Goal Allocations ────────────────────────────────────

export async function getAllocations(circleId: string, goalId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })

  const goal = await prisma.goal.findUnique({ where: { id: goalId, deletedAt: null } })
  if (!goal || goal.circleId !== circleId) throw new Error("Goal not found")

  const allocations = await prisma.goalAllocation.findMany({
    where: { goalId, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { allocationDate: "desc" },
  })

  return allocations.map((a) => ({
    ...a,
    amount: Number(a.amount),
  }))
}

export async function allocateToGoal(
  circleId: string,
  goalId: string,
  actorUserId: string,
  data: { userId: string; contributionId?: string | null; amount: number; allocationDate: string; note?: string | null }
) {
  await requireCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  const hasCreate = await hasCirclePermission({ userId: actorUserId, circleId, permission: CIRCLE_PERMISSIONS.GOAL_CREATE })
  if (!hasCreate && data.userId !== actorUserId) {
    throw new Error("Members can only allocate their own funds")
  }

  const goal = await prisma.goal.findUnique({ where: { id: goalId, deletedAt: null } })
  if (!goal || goal.circleId !== circleId) throw new Error("Goal not found")
  if (goal.status !== "ACTIVE") throw new Error("Cannot allocate to a non-active goal")

  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: data.userId } },
  })
  if (!member) throw new Error("User is not a member of this circle")

  const allocation = await prisma.goalAllocation.create({
    data: {
      circleId,
      goalId,
      userId: data.userId,
      contributionId: data.contributionId || null,
      amount: data.amount,
      note: data.note || null,
      allocationDate: new Date(data.allocationDate),
      createdById: actorUserId,
    },
  })

  const newCurrent = Number(goal.currentAmount) + data.amount
  const completed = newCurrent >= Number(goal.targetAmount)

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      currentAmount: newCurrent,
      ...(completed ? { status: "COMPLETED" } : {}),
    },
  })

  const allocName = "A member"

  if (completed) {
    notifyCircleMembers(circleId, actorUserId, {
      type: "GOAL_COMPLETED",
      title: `Goal completed: ${goal.name}`,
      message: `${goal.name} has reached its target! ${newCurrent} of ${goal.targetAmount}`,
      link: `/circles/${circleId}/goals`,
    })
  } else {
    notifyCircleMembers(circleId, actorUserId, {
      type: "GOAL_ALLOCATION_ADDED",
      title: `${allocName} allocated to ${goal.name}`,
      message: `${allocName} allocated ${data.amount} to "${goal.name}"`,
      link: `/circles/${circleId}/goals`,
    })
  }

  return {
    ...allocation,
    amount: Number(allocation.amount),
    goalCompleted: completed,
    newCurrentAmount: newCurrent,
  }
}

// ─── Stats ────────────────────────────────────────────────

export async function getGoalStats(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })

  const [active, totalSaved, totalTarget, completed] = await Promise.all([
    prisma.goal.count({ where: { circleId, status: "ACTIVE", deletedAt: null } }),
    prisma.goal.aggregate({
      where: { circleId, deletedAt: null },
      _sum: { currentAmount: true },
    }),
    prisma.goal.aggregate({
      where: { circleId, deletedAt: null },
      _sum: { targetAmount: true },
    }),
    prisma.goal.count({ where: { circleId, status: "COMPLETED", deletedAt: null } }),
  ])

  const saved = Number(totalSaved._sum.currentAmount ?? 0)
  const target = Number(totalTarget._sum.targetAmount ?? 0)

  return {
    activeGoals: active,
    completedGoals: completed,
    totalSaved: saved,
    totalTarget: target,
    overallProgress: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0,
  }
}
