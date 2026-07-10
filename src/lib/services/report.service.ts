import { prisma } from "@/lib/prisma"

async function requireMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

export async function getContributionReport(circleId: string, userId: string) {
  await requireMember(circleId, userId)
  const [total, byMember, byPlan] = await Promise.all([
    prisma.contribution.aggregate({ where: { circleId, deletedAt: null }, _sum: { amount: true }, _count: true }),
    prisma.contribution.groupBy({ by: ["userId"], where: { circleId, deletedAt: null }, _sum: { amount: true }, _count: true }),
    prisma.contributionPlan.findMany({ where: { circleId, deletedAt: null }, select: { id: true, name: true, amount: true, frequency: true } }),
  ])
  const members = await prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { id: true, name: true, email: true } } } })
  return {
    total: Number(total._sum.amount ?? 0), count: total._count,
    byMember: byMember.map((b) => ({ userId: b.userId, total: Number(b._sum.amount ?? 0), count: b._count, name: members.find((m) => m.userId === b.userId)?.user.name || "?" })),
    plans: byPlan.map((p) => ({ ...p, amount: Number(p.amount) })),
  }
}

export async function getExpenseReport(circleId: string, userId: string) {
  await requireMember(circleId, userId)
  const [total, byPayer, byCategory] = await Promise.all([
    prisma.expense.aggregate({ where: { circleId, deletedAt: null }, _sum: { amount: true }, _count: true }),
    prisma.expense.groupBy({ by: ["paidById"], where: { circleId, deletedAt: null }, _sum: { amount: true }, _count: true }),
    prisma.expense.groupBy({ by: ["category"], where: { circleId, deletedAt: null }, _sum: { amount: true }, _count: true }),
  ])
  const members = await prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { id: true, name: true } } } })
  return {
    total: Number(total._sum.amount ?? 0), count: total._count,
    byPayer: byPayer.map((b) => ({ userId: b.paidById, total: Number(b._sum.amount ?? 0), count: b._count, name: members.find((m) => m.userId === b.paidById)?.user.name || "?" })),
    byCategory: byCategory.map((b) => ({ category: b.category, total: Number(b._sum.amount ?? 0), count: b._count })),
  }
}

export async function getBalanceReport(circleId: string, userId: string) {
  await requireMember(circleId, userId)
  const balances = await prisma.balance.findMany({
    where: { circleId, amount: { gt: 0 } },
    include: { debtor: { select: { name: true, email: true } }, creditor: { select: { name: true, email: true } } },
    orderBy: { amount: "desc" },
  })
  return balances.map((b) => ({ ...b, amount: Number(b.amount) }))
}

export async function getGoalReport(circleId: string, userId: string) {
  await requireMember(circleId, userId)
  const goals = await prisma.goal.findMany({
    where: { circleId, deletedAt: null },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return goals.map((g) => ({ ...g, targetAmount: Number(g.targetAmount), currentAmount: Number(g.currentAmount), progress: Number(g.targetAmount) > 0 ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0 }))
}

export async function getMemberSummaryReport(circleId: string, userId: string) {
  await requireMember(circleId, userId)
  const members = await prisma.circleMember.findMany({
    where: { circleId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  const memberIds = members.map((m) => m.userId)
  const [contribByUser, expenseByUser, allocationByUser] = await Promise.all([
    prisma.contribution.groupBy({ by: ["userId"], where: { circleId, userId: { in: memberIds }, deletedAt: null }, _sum: { amount: true }, _count: true }),
    prisma.expenseSplit.groupBy({ by: ["userId"], where: { expense: { circleId, deletedAt: null }, userId: { in: memberIds } }, _sum: { amount: true } }),
    prisma.goalAllocation.groupBy({ by: ["userId"], where: { circleId, userId: { in: memberIds }, deletedAt: null }, _sum: { amount: true } }),
  ])
  const summary = members.map((m) => {
    const c = contribByUser.find((x) => x.userId === m.userId)
    const e = expenseByUser.find((x) => x.userId === m.userId)
    const a = allocationByUser.find((x) => x.userId === m.userId)
    return { userId: m.userId, name: m.user.name || m.user.email, role: m.role, contributed: Number(c?._sum.amount ?? 0), contributionCount: c?._count ?? 0, expenseShare: Number(e?._sum.amount ?? 0), allocated: Number(a?._sum.amount ?? 0) }
  })
  return summary
}

export async function getMonthlyStatement(circleId: string, userId: string, month?: number, year?: number) {
  await requireMember(circleId, userId)
  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0, 23, 59, 59)

  const [contributions, expenses, settlements, allocations] = await Promise.all([
    prisma.contribution.aggregate({ where: { circleId, deletedAt: null, paymentDate: { gte: start, lte: end } }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { circleId, deletedAt: null, expenseDate: { gte: start, lte: end } }, _sum: { amount: true }, _count: true }),
    prisma.settlement.findMany({ where: { circleId, status: "CONFIRMED", deletedAt: null, settlementDate: { gte: start, lte: end } }, select: { amount: true, debtorId: true, creditorId: true, settlementDate: true }, orderBy: { settlementDate: "desc" } }),
    prisma.goalAllocation.aggregate({ where: { circleId, deletedAt: null, allocationDate: { gte: start, lte: end } }, _sum: { amount: true }, _count: true }),
  ])

  const members = await getMemberSummaryReport(circleId, userId)

  return {
    period: `${start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}`,
    contributions: { total: Number(contributions._sum.amount ?? 0), count: contributions._count },
    expenses: { total: Number(expenses._sum.amount ?? 0), count: expenses._count },
    settlements: settlements.map((s) => ({ ...s, amount: Number(s.amount) })),
    allocations: { total: Number(allocations._sum.amount ?? 0), count: allocations._count },
    netActivity: Number(contributions._sum.amount ?? 0) - Number(expenses._sum.amount ?? 0) + Number(allocations._sum.amount ?? 0),
    members,
  }
}
