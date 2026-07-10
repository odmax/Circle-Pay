import { prisma } from "@/lib/prisma"
import { getCircleStats } from "@/lib/services/circle.service"
import { getGoalStats } from "@/lib/services/goal.service"

export async function getUserDashboard(userId: string) {
  console.time("Dashboard: getUserDashboard")
  const circles = await prisma.circleMember.findMany({
    where: { userId, circle: { deletedAt: null } },
    include: {
      circle: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
  })

  const circleIds = circles.map((c) => c.circleId)

  if (circleIds.length === 0) {
    return {
      userCircles: [],
      stats: {
        totalCircles: 0,
        totalContributions: 0,
        totalCirclePool: 0,
        activeGoals: 0,
        completedGoals: 0,
        totalGoalTarget: 0,
        totalGoalSaved: 0,
        pendingContributions: 0,
      },
      recentActivity: [],
    }
  }

  const [contribAgg, goalAgg, completedGoals, pendingAgg, recentContributions, recentGoalAllocations] =
    await Promise.all([
      prisma.contribution.aggregate({
        where: { circleId: { in: circleIds }, status: "PAID", deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.goal.aggregate({
        where: { circleId: { in: circleIds }, status: "ACTIVE", deletedAt: null },
        _sum: { currentAmount: true, targetAmount: true },
        _count: true,
      }),
      prisma.goal.count({
        where: { circleId: { in: circleIds }, status: "COMPLETED", deletedAt: null },
      }),
      prisma.contribution.aggregate({
        where: { circleId: { in: circleIds }, status: "PENDING", deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.contribution.findMany({
        where: { circleId: { in: circleIds }, deletedAt: null },
        include: {
          user: { select: { id: true, name: true } },
          circle: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
          take: 10,
        }),
      prisma.goalAllocation.findMany({
        where: { circleId: { in: circleIds } },
        include: {
          user: { select: { id: true, name: true } },
          goal: { select: { id: true, name: true } },
          circle: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

  const circlesWithStats = await Promise.all(
    circles.map(async (m) => {
      const stats = await getCircleStats(m.circleId, userId)
      return {
        id: m.circle.id,
        name: m.circle.name,
        type: m.circle.type,
        currency: m.circle.currency,
        memberCount: m.circle._count.members,
        role: m.role,
        totalContributions: stats.totalContributions,
        activeGoals: stats.activeGoals,
      }
    })
  )

  const activity = buildActivityFeed(
    recentContributions.map((c) => ({
      type: "contribution" as const,
      title: `${c.user.name || "A member"} paid`,
      description: `${c.circle.name}`,
      amount: Number(c.amount),
      date: c.createdAt,
      circleName: c.circle.name,
      link: `/circles/${c.circleId}/contributions`,
    })),
    recentGoalAllocations.map((a) => ({
      type: "allocation" as const,
      title: `${a.user.name || "A member"} allocated`,
      description: `to ${a.goal.name} in ${a.circle.name}`,
      amount: Number(a.amount),
      date: a.createdAt,
      circleName: a.circle.name,
      link: `/circles/${a.circleId}/goals`,
    }))
  )

  console.timeEnd("Dashboard: getUserDashboard")
  return {
    userCircles: circlesWithStats,
    stats: {
      totalCircles: circles.length,
      totalContributions: Number(contribAgg._sum.amount ?? 0),
      totalCirclePool: Number(contribAgg._sum.amount ?? 0),
      activeGoals: goalAgg._count,
      completedGoals,
      totalGoalTarget: Number(goalAgg._sum.targetAmount ?? 0),
      totalGoalSaved: Number(goalAgg._sum.currentAmount ?? 0),
      pendingContributions: Number(pendingAgg._sum.amount ?? 0),
    },
    recentActivity: activity,
  }
}

export async function getCircleDashboard(circleId: string, userId: string) {
  const [stats, goalStats, recentContributions, recentAllocations, activePlans] =
    await Promise.all([
      getCircleStats(circleId, userId),
      getGoalStats(circleId, userId),
      prisma.contribution.findMany({
        where: { circleId, deletedAt: null },
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.goalAllocation.findMany({
        where: { circleId, deletedAt: null },
        include: { user: { select: { id: true, name: true, image: true } }, goal: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.contributionPlan.count({ where: { circleId, isActive: true, deletedAt: null } }),
    ])

  return {
    circleStats: {
      totalContributions: stats.totalContributions,
      activeGoals: goalStats.activeGoals,
      totalGoalSaved: goalStats.totalSaved,
      totalGoalTarget: goalStats.totalTarget,
      goalProgress: goalStats.overallProgress,
      completedGoals: goalStats.completedGoals,
      pendingBalances: stats.pendingBalances,
      activePlans,
    },
    recentContributions: recentContributions.map((c) => ({
      id: c.id,
      amount: Number(c.amount),
      status: c.status,
      createdAt: c.createdAt,
      user: c.user,
    })),
    recentAllocations: recentAllocations.map((a) => ({
      id: a.id,
      amount: Number(a.amount),
      createdAt: a.createdAt,
      user: a.user,
      goal: a.goal,
    })),
  }
}

interface ActivityItem {
  type: string
  title: string
  description: string
  amount: number
  date: Date
  circleName: string
  link: string
}

function buildActivityFeed(
  contributions: ActivityItem[],
  allocations: ActivityItem[]
) {
  const all = [...contributions, ...allocations]
  all.sort((a, b) => b.date.getTime() - a.date.getTime())
  return all.slice(0, 10)
}
