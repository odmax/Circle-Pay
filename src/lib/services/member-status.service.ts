import { prisma } from "@/lib/prisma"

export async function getMemberCircleStatus(circleId: string, userId: string) {
  const [circle, member, payments, contributions, expenses, balances, goals] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, include: { contributionPlans: { where: { isActive: true }, take: 1 }, _count: { select: { members: true } } } }),
    prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } }),
    prisma.circlePaymentIntent.findMany({ where: { userId, circleId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.contribution.findMany({ where: { userId, circleId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.expense.findMany({ where: { circleId }, include: { splits: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.balance.findMany({ where: { circleId, OR: [{ debtorId: userId }, { creditorId: userId }] }, include: { debtor: { select: { name: true } }, creditor: { select: { name: true } } } }),
    prisma.goal.findMany({ where: { circleId }, include: { allocations: { where: { userId } } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ])

  if (!circle || !member) throw new Error("Not a member")

  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyContribs = contributions.filter((c) => new Date(c.createdAt) >= monthStart)
  const monthlyPaid = monthlyContribs.reduce((sum, c) => sum + Number(c.amount), 0)
  const allPaid = contributions.reduce((sum, c) => sum + Number(c.amount), 0)

  const pendingPayments = payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
  const awaitingProof = payments.filter((p) => p.status === "PROOF_SUBMITTED")
  const overdueCount = payments.filter((p) => p.status === "OVERDUE").length

  const myExpenses = expenses.flatMap((e) => e.splits.filter((s) => s.userId === userId).map((s) => ({ title: e.title, amount: Number(s.amount), date: e.createdAt })))
  const expenseTotal = myExpenses.reduce((sum, e) => sum + e.amount, 0)

  const owedByMe = balances.filter((b) => b.debtorId === userId).reduce((sum, b) => sum + Number(b.amount), 0)
  const owedToMe = balances.filter((b) => b.creditorId === userId).reduce((sum, b) => sum + Number(b.amount), 0)

  const plan = circle.contributionPlans[0]
  const expectedMonthly = plan ? Number(plan.amount) : 0

  // Investment ownership
  let ownership = 0
  if (circle.type === "INVESTMENT") {
    const totalContribs = await prisma.contribution.aggregate({ where: { circleId }, _sum: { amount: true } })
    const total = Number(totalContribs._sum.amount ?? 0)
    if (total > 0) ownership = Math.round((allPaid / total) * 100)
  }

  // Stokvel payout position
  let payoutInfo = null
  if (circle.type === "STOKVEL") {
    const myPayout = await prisma.payoutCycle.findFirst({ where: { circleId, recipientId: userId, status: { in: ["UPCOMING", "READY"] } }, orderBy: { cycleNumber: "asc" } })
    const completedPayouts = await prisma.payoutCycle.count({ where: { circleId, status: "COMPLETED" } })
    if (myPayout) payoutInfo = { position: myPayout.cycleNumber, amount: Number(myPayout.amount), date: myPayout.dueDate }
    else payoutInfo = { completedPayouts, message: "Not your payout turn yet" }
  }

  const goalAllocations = goals.flatMap((g) => g.allocations.filter((a) => a.userId).map((a) => ({ goal: g.name, target: Number(g.targetAmount), current: Number(g.currentAmount), myShare: Number(a.amount) })))

  const warnings: string[] = []
  if (overdueCount > 0) warnings.push(`${overdueCount} overdue payment${overdueCount > 1 ? "s" : ""}`)
  if (pendingPayments.length > 0 && pendingPayments.every((p) => p.dueDate && new Date(p.dueDate) < new Date(Date.now() + 3 * 86400000))) warnings.push("Dues due soon")
  if (expectedMonthly > 0 && monthlyPaid === 0) warnings.push("No contribution this month")

  const nextActions: { label: string; href: string }[] = []
  if (pendingPayments.length > 0) nextActions.push({ label: "Submit Payment Proof", href: `/circles/${circleId}/payments` })
  if (expectedMonthly > 0) nextActions.push({ label: "Record Contribution", href: `/circles/${circleId}/contributions` })
  if (owedByMe > 0) nextActions.push({ label: "Settle Balance", href: `/circles/${circleId}/balances` })

  return {
    member: { role: member.role, joinedAt: member.joinedAt },
    circle: { name: circle.name, type: circle.type, memberCount: circle._count.members },
    payments: { pending: pendingPayments.length, awaiting: awaitingProof.length, overdue: overdueCount, unpaid: pendingPayments.map((p) => ({ id: p.id, type: p.type, amount: Number(p.amount), dueDate: p.dueDate, status: p.status })) },
    contributions: { total: allPaid, thisMonth: monthlyPaid, expectedMonthly, count: contributions.length },
    expenses: { myShare: expenseTotal, items: myExpenses.slice(0, 5) },
    balances: { owedByMe, owedToMe, net: owedToMe - owedByMe },
    goals: { myAllocations: goalAllocations },
    investment: circle.type === "INVESTMENT" ? { capitalContributed: allPaid, ownership } : undefined,
    stokvel: circle.type === "STOKVEL" ? payoutInfo : undefined,
    warnings,
    nextActions,
  }
}

export async function getMemberStatement(circleId: string, userId: string) {
  const [contributions, expenses, balances, payouts, payments] = await Promise.all([
    prisma.contribution.findMany({ where: { userId, circleId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.expense.findMany({ where: { circleId }, include: { splits: { where: { userId } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.balance.findMany({ where: { circleId, OR: [{ debtorId: userId }, { creditorId: userId }] }, include: { debtor: { select: { name: true } }, creditor: { select: { name: true } } } }),
    prisma.payoutCycle.findMany({ where: { circleId, recipientId: userId } }),
    prisma.circlePaymentIntent.findMany({ where: { userId, circleId }, orderBy: { createdAt: "desc" } }),
  ])

  const myExpenses = expenses.flatMap((e) => e.splits.map((s) => ({ title: e.title, amount: Number(s.amount), date: e.createdAt, status: "CONFIRMED" })))

  return {
    contributions: contributions.map((c) => ({ id: c.id, amount: Number(c.amount), status: c.status, date: c.paymentDate, note: c.note })),
    expenses: myExpenses,
    balances: balances.map((b) => ({ id: b.id, amount: Number(b.amount), debtor: b.debtor?.name, creditor: b.creditor?.name, direction: b.debtorId === userId ? "owed" : "owing" })),
    payouts: payouts.map((p) => ({ cycle: p.cycleNumber, amount: Number(p.amount), status: p.status, date: p.completedAt })),
    payments: payments.map((p) => ({ type: p.type, amount: Number(p.amount), status: p.status, dueDate: p.dueDate })),
    totals: {
      contributions: contributions.reduce((s, c) => s + Number(c.amount), 0),
      expensesShared: myExpenses.reduce((s, e) => s + e.amount, 0),
    },
  }
}
