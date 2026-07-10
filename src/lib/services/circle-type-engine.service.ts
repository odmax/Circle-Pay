import { prisma } from "@/lib/prisma"

export async function getCircleTypeEngine(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, include: { _count: { select: { members: true } }, members: true } })
  if (!circle) throw new Error("Circle not found")
  const engines: Record<string, Function> = { STOKVEL: getStokvelEngine, INVESTMENT: getInvestmentEngine, HOUSEMATE: getHousemateEngine, TRAVEL: getTravelEngine, SAVINGS: getSavingsEngine, WEDDING: getWeddingEngine, CHURCH: getChurchEngine, FAMILY: getFamilyEngine }
  const fn = engines[circle.type]
  if (fn) return fn(circleId)
  return getCustomEngine(circleId)
}

export async function getStokvelEngine(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } })
  if (!circle) throw new Error("Not found")
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [contribs, plans, payouts] = await Promise.all([
    prisma.contribution.findMany({ where: { circleId, createdAt: { gte: monthStart } }, include: { user: { select: { name: true } } } }),
    prisma.contributionPlan.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 1 }),
    prisma.payoutCycle.findMany({ where: { circleId, status: { not: "CANCELLED" } }, orderBy: { cycleNumber: "asc" }, include: { recipient: { select: { name: true } } } }),
  ])

  const plan = plans[0]
  const monthlyAmount = plan ? Number(plan.amount) : 0
  const totalThisMonth = contribs.length * monthlyAmount
  const expectedTotal = circle.members.length * monthlyAmount
  const paidMemberIds = new Set(contribs.map((c) => c.userId))
  const paid = circle.members.filter((m) => paidMemberIds.has(m.userId))
  const unpaid = circle.members.filter((m) => !paidMemberIds.has(m.userId))
  const completedPayouts = payouts.filter((p) => p.status === "COMPLETED")
  const nextPayout = payouts.find((p) => p.status === "UPCOMING" || p.status === "READY")

  return {
    type: "STOKVEL", title: "Stokvel Operations", description: "Monthly collections, payout rotation, and member tracking",
    primaryMetrics: [
      { label: "Expected Pool", value: `R${expectedTotal.toLocaleString()}`, sub: `${monthlyAmount > 0 ? `R${monthlyAmount}` : "?"} per member` },
      { label: "Collected", value: `R${totalThisMonth.toLocaleString()}`, sub: `${paid.length}/${circle.members.length} members` },
      { label: "Outstanding", value: `R${(expectedTotal - totalThisMonth).toLocaleString()}`, sub: unpaid.length > 0 ? `${unpaid.length} unpaid` : "All paid" },
      { label: "Payouts Completed", value: String(completedPayouts.length), sub: nextPayout ? `Next: ${nextPayout.recipient?.name || "?"}` : "None" },
    ],
    paidMembers: paid.map((m) => ({ name: m.user.name || m.user.email, amount: monthlyAmount })),
    unpaidMembers: unpaid.map((m) => ({ name: m.user.name || m.user.email, amount: monthlyAmount })),
    payoutCycles: payouts.map((p) => ({ name: p.recipient?.name, status: p.status, amount: Number(p.amount), order: p.cycleNumber })),
    nextActions: ["Record contribution", "View unpaid members", "Generate payout schedule"],
  }
}

export async function getInvestmentEngine(circleId: string) {
  const [circle, contribs, assets, returns] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, include: { members: { include: { user: { select: { id: true, name: true } } } } } }),
    prisma.contribution.findMany({ where: { circleId }, include: { user: { select: { name: true } } } }),
    prisma.investmentAsset.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } }),
    prisma.investmentReturn.findMany({ where: { circleId }, orderBy: { returnDate: "desc" } }),
  ])
  if (!circle) throw new Error("Not found")
  const totalCapital = contribs.reduce((sum, c) => sum + Number(c.amount), 0)
  const totalAssetValue = assets.reduce((sum, a) => sum + Number(a.currentValue), 0)
  const totalReturns = returns.reduce((sum, r) => sum + Number(r.amount), 0)
  const memberContribs: Record<string, number> = {}
  for (const c of contribs) memberContribs[c.userId] = (memberContribs[c.userId] || 0) + Number(c.amount)

  return {
    type: "INVESTMENT", title: "Investment Operations", description: "Capital, assets, returns, and member ownership",
    primaryMetrics: [
      { label: "Capital Pool", value: `R${totalCapital.toLocaleString()}`, sub: `${contribs.length} contributions` },
      { label: "Asset Value", value: `R${totalAssetValue.toLocaleString()}`, sub: `${assets.length} assets` },
      { label: "Total Returns", value: `R${totalReturns.toLocaleString()}`, sub: `${returns.length} returns` },
      { label: "Members", value: String(circle.members.length) },
    ],
    ownership: circle.members.map((m) => ({ name: m.user.name || "", share: totalCapital > 0 ? Math.round((memberContribs[m.userId] || 0) / totalCapital * 100) : 0 })),
    assets: assets.map((a) => ({ name: a.name, type: a.type, purchase: Number(a.purchaseAmount), current: Number(a.currentValue) })),
    returns: returns.map((r) => ({ amount: Number(r.amount), type: r.returnType, date: r.returnDate })),
    nextActions: ["Record monthly due", "Add investment asset", "Record return"],
  }
}

export async function getHousemateEngine(circleId: string) {
  const [circle, expenses] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, include: { members: { include: { user: { select: { id: true, name: true } } } } } }),
    prisma.expense.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ])
  if (!circle) throw new Error("Not found")
  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthExpenses = expenses.filter((e) => new Date(e.createdAt) >= monthStart)
  const totalMonth = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return {
    type: "HOUSEMATE", title: "Housemate Operations", description: "Rent, utilities, groceries, and shared expenses",
    primaryMetrics: [
      { label: "Month Expenses", value: `R${totalMonth.toLocaleString()}`, sub: `${monthExpenses.length} expenses` },
      { label: "Members", value: String(circle.members.length) },
    ],
    recentExpenses: expenses.slice(0, 10).map((e) => ({ name: e.title, amount: Number(e.amount), date: e.createdAt })),
    nextActions: ["Add rent payment", "Add utility bill", "Settle balances"],
  }
}

export async function getTravelEngine(circleId: string) {
  const [circle, goals, expenses] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId } }),
    prisma.goal.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 1 }),
    prisma.expense.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } }),
  ])
  if (!circle) throw new Error("Not found")
  const goal = goals[0]
  const target = goal ? Number(goal.targetAmount) : 0
  const saved = goal ? Number(goal.currentAmount) : 0
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  return {
    type: "TRAVEL", title: "Travel Planner", description: "Trip budget, savings progress, and travel expenses",
    primaryMetrics: [
      { label: "Budget", value: `R${target.toLocaleString()}`, sub: goal?.name || "No goal set" },
      { label: "Saved", value: `R${saved.toLocaleString()}`, sub: target > 0 ? `${Math.round(saved / target * 100)}%` : "0%" },
      { label: "Remaining", value: `R${(target - saved).toLocaleString()}` },
      { label: "Expenses", value: `R${totalExpenses.toLocaleString()}` },
    ],
    nextActions: ["Add trip expense", "Record saving", "View budget"],
  }
}

export async function getSavingsEngine(circleId: string) {
  const [circle, goals, contribs] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, include: { members: { include: { user: { select: { id: true, name: true } } } } } }),
    prisma.goal.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 1 }),
    prisma.contribution.findMany({ where: { circleId } }),
  ])
  if (!circle) throw new Error("Not found")
  const goal = goals[0]
  const target = goal ? Number(goal.targetAmount) : 0
  const saved = goal ? Number(goal.currentAmount) : 0
  return {
    type: "SAVINGS", title: "Savings Tracker", description: "Goal-based savings with member contributions",
    primaryMetrics: [
      { label: "Target", value: `R${target.toLocaleString()}`, sub: goal?.name || "No goal" },
      { label: "Progress", value: `${target > 0 ? Math.round(saved / target * 100) : 0}%`, sub: `R${saved.toLocaleString()} saved` },
      { label: "Contributions", value: String(contribs.length) },
      { label: "Members", value: String(circle.members.length) },
    ],
    nextActions: ["Add saving", "Update goal", "View progress"],
  }
}

export async function getWeddingEngine(circleId: string) {
  const [circle, goals, expenses] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId } }),
    prisma.goal.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 1 }),
    prisma.expense.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } }),
  ])
  if (!circle) throw new Error("Not found")
  const goal = goals[0]; const target = goal ? Number(goal.targetAmount) : 0; const saved = goal ? Number(goal.currentAmount) : 0
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  return {
    type: "WEDDING", title: "Wedding Planner", description: "Budget, vendor expenses, and savings progress",
    primaryMetrics: [
      { label: "Budget", value: `R${target.toLocaleString()}`, sub: goal?.name || "No budget" },
      { label: "Saved", value: `R${saved.toLocaleString()}`, sub: target > 0 ? `${Math.round(saved / target * 100)}%` : "0%" },
      { label: "Spent", value: `R${totalExpenses.toLocaleString()}`, sub: `${expenses.length} expenses` },
      { label: "Remaining", value: `R${Math.max(0, target - totalExpenses).toLocaleString()}` },
    ],
    nextActions: ["Add vendor expense", "Record saving", "View budget"],
  }
}

export async function getChurchEngine(circleId: string) {
  const [circle, goals, contribs, expenses] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId } }),
    prisma.goal.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 1 }),
    prisma.contribution.findMany({ where: { circleId } }),
    prisma.expense.findMany({ where: { circleId } }),
  ])
  if (!circle) throw new Error("Not found")
  const goal = goals[0]; const target = goal ? Number(goal.targetAmount) : 0; const saved = goal ? Number(goal.currentAmount) : 0
  const totalContribs = contribs.reduce((sum, c) => sum + Number(c.amount), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  return {
    type: "CHURCH", title: "Church Finance", description: "Offerings, tithes, building fund, and projects",
    primaryMetrics: [
      { label: "Goal", value: `R${target.toLocaleString()}`, sub: goal?.name || "No goal" },
      { label: "Received", value: `R${totalContribs.toLocaleString()}`, sub: `${contribs.length} contributions` },
      { label: "Progress", value: `${target > 0 ? Math.round(saved / target * 100) : 0}%` },
      { label: "Expenses", value: `R${totalExpenses.toLocaleString()}` },
    ],
    nextActions: ["Record offering", "Create goal", "View expenses"],
  }
}

export async function getFamilyEngine(circleId: string) {
  const [circle, contribs, expenses] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, include: { members: { include: { user: { select: { id: true, name: true } } } } } }),
    prisma.contribution.findMany({ where: { circleId } }),
    prisma.expense.findMany({ where: { circleId } }),
  ])
  if (!circle) throw new Error("Not found")
  const totalContribs = contribs.reduce((sum, c) => sum + Number(c.amount), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  return {
    type: "FAMILY", title: "Family Fund", description: "Emergency fund, support payouts, and shared family expenses",
    primaryMetrics: [
      { label: "Pool", value: `R${totalContribs.toLocaleString()}`, sub: `${contribs.length} contributions` },
      { label: "Spent", value: `R${totalExpenses.toLocaleString()}`, sub: `${expenses.length} expenses` },
      { label: "Balance", value: `R${(totalContribs - totalExpenses).toLocaleString()}` },
      { label: "Members", value: String(circle.members.length) },
    ],
    nextActions: ["Record contribution", "Add expense", "View balances"],
  }
}

export async function getCustomEngine(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, include: { members: true, _count: { select: { contributions: true, expenses: true, goals: true } } } })
  if (!circle) throw new Error("Not found")
  return {
    type: "CUSTOM", title: "Circle Overview", description: "General circle metrics",
    primaryMetrics: [
      { label: "Members", value: String(circle.members.length) },
      { label: "Contributions", value: String(circle._count.contributions) },
      { label: "Expenses", value: String(circle._count.expenses) },
      { label: "Goals", value: String(circle._count.goals) },
    ],
    nextActions: ["Record contribution", "Add expense", "Create goal"],
  }
}
