import { prisma } from "@/lib/prisma"
import type { AIInsightType, AIInsightSeverity } from "@/generated/prisma"

export async function getCircleInsights(circleId: string, userId: string) {
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  })
  if (!member) throw new Error("Not a member")

  const insights = await prisma.aIInsight.findMany({
    where: { circleId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  return insights
}

export async function markInsightRead(userId: string, insightId: string) {
  return prisma.aIInsight.update({ where: { id: insightId }, data: { isRead: true } })
}

export async function generateBasicInsights(circleId: string) {
  console.time("AI: generateBasicInsights")
  const [goals, contributions, expenses, balances] = await Promise.all([
    prisma.goal.findMany({ where: { circleId, status: "ACTIVE" } }),
    prisma.contribution.aggregate({ where: { circleId, status: "PAID" }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { circleId }, _sum: { amount: true }, _count: true }),
    prisma.balance.count({ where: { circleId, amount: { gt: 0 } } }),
  ])

  const totalPaid = Number(contributions._sum.amount ?? 0)

  // Generate basic insights from data
  const newInsights: { type: string; title: string; content: string; severity: string }[] = []

  if (goals.length > 0) {
    const nearComplete = goals.filter((g) => {
      const pct = Number(g.targetAmount) > 0 ? Number(g.currentAmount) / Number(g.targetAmount) : 0
      return pct >= 0.8 && pct < 1
    })
    if (nearComplete.length > 0) {
      newInsights.push({ type: "GOAL_FORECAST", title: `${nearComplete.length} goal${nearComplete.length > 1 ? "s" : ""} near completion`, content: `Almost there! ${nearComplete.map((g) => g.name).join(", ")} ${nearComplete.length > 1 ? "are" : "is"} at 80%+ of target.`, severity: "SUCCESS" })
    }
  }

  if (totalPaid > 0 && Number(contributions._count) >= 5) {
    newInsights.push({ type: "CONTRIBUTION_PATTERN", title: "Consistent contributions", content: `Circle members have made ${contributions._count} contributions totalling ${totalPaid}. Keep the momentum!`, severity: "SUCCESS" })
  }

  if (Number(expenses._count) > 0) {
    newInsights.push({ type: "SPENDING_PATTERN", title: `${expenses._count} expense${Number(expenses._count) !== 1 ? "s" : ""} recorded`, content: `Total expenses: ${Number(expenses._sum.amount ?? 0)}. Split fairly with Circle Pay.`, severity: "INFO" })
  }

  if (balances > 0) {
    newInsights.push({ type: "MEMBER_RISK", title: "Outstanding balances", content: `There ${balances === 1 ? "is" : "are"} ${balances} outstanding balance${balances !== 1 ? "s" : ""}. Settle up to clear the ledger.`, severity: balances >= 3 ? "WARNING" : "INFO" })
  }

  for (const insight of newInsights) {
    await prisma.aIInsight.create({ data: { circleId, type: insight.type as AIInsightType, title: insight.title, content: insight.content, severity: insight.severity as AIInsightSeverity } })
  }
  console.timeEnd("AI: generateBasicInsights")
}

// ═══════════════════════════════════════════════════════════
// CIRCLE ASSISTANT — rule-based insights
// ═══════════════════════════════════════════════════════════

export async function generateAssistantInsights(circleId: string) {
  console.time("AI: generateAssistantInsights")
  const insights: { type: string; title: string; content: string; severity: string; action?: string }[] = []
  const [paidAgg, totalAgg, goals, expenses, balances, payouts, polls, events] = await Promise.all([
    prisma.contribution.aggregate({ where: { circleId, deletedAt: null, status: "PAID" }, _sum: { amount: true }, _count: true }),
    prisma.contribution.aggregate({ where: { circleId, deletedAt: null }, _count: true }),
    prisma.goal.findMany({ where: { circleId, deletedAt: null, status: "ACTIVE" }, select: { name: true, currentAmount: true, targetAmount: true } }),
    prisma.expense.aggregate({ where: { circleId, deletedAt: null }, _sum: { amount: true }, _count: true }),
    prisma.balance.count({ where: { circleId, amount: { gt: 0 } } }),
    prisma.payoutCycle.findMany({ where: { circleId }, select: { status: true } }),
    prisma.circlePoll.count({ where: { circleId, deletedAt: null, status: "OPEN" } }),
    prisma.circleEvent.count({ where: { circleId, deletedAt: null, status: "UPCOMING" } }),
  ])

  const paid = Number(paidAgg._sum.amount ?? 0)
  const contribCount = paidAgg._count
  const totalContribs = totalAgg._count
  const compliance = totalContribs > 0 ? Math.round((contribCount / totalContribs) * 100) : 0

  // Contribution insights
  if (paid > 0) {
    insights.push({ type: "CONTRIBUTION_PATTERN", title: "Contribution Summary", content: `${totalContribs} contributions recorded, totalling ${paid}.`, severity: "INFO" })
  } else {
    insights.push({ type: "CONTRIBUTION_PATTERN", title: "No contributions yet", content: "Start tracking contributions to see insights.", severity: "INFO", action: "Record contribution" })
  }

  // Goal insights
  for (const g of goals) {
    const pct = Number(g.targetAmount) > 0 ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0
    if (pct >= 90) insights.push({ type: "GOAL_FORECAST", title: `Almost there: ${g.name}`, content: `${g.name} is at ${pct}% — only ${Number(g.targetAmount) - Number(g.currentAmount)} left.`, severity: "SUCCESS" })
    else if (pct > 0) insights.push({ type: "GOAL_FORECAST", title: `${g.name}: ${pct}%`, content: `${g.name} is progressing. Current: ${Number(g.currentAmount)} of ${Number(g.targetAmount)}.`, severity: pct < 30 ? "WARNING" : "INFO" })
  }

  // Expense insights
  const expenseTotal = Number(expenses._sum.amount ?? 0)
  if (expenseTotal > 0) insights.push({ type: "SPENDING_PATTERN", title: "Expense Overview", content: `${expenses._count} expenses recorded totalling ${expenseTotal}.`, severity: "INFO" })

  // Balance insights
  if (balances > 0) {
    insights.push({ type: "MEMBER_RISK", title: "Outstanding Balances", content: `${balances} balance${balances !== 1 ? "s" : ""} need${balances === 1 ? "s" : ""} settling.`, severity: balances >= 3 ? "WARNING" : "INFO", action: "View balances" })
  }

  // Payout insights
  const pendingPayouts = (payouts as unknown as { status: string }[]).filter((p) => p.status === "UPCOMING" || p.status === "READY").length
  if (pendingPayouts > 0) insights.push({ type: "PAYOUT_TRACKER", title: "Upcoming Payouts", content: `${pendingPayouts} payout${pendingPayouts !== 1 ? "s" : ""} scheduled.`, severity: "INFO" })

  // Engagement
  if (polls > 0) insights.push({ type: "GENERAL", title: "Active Polls", content: `${polls} poll${polls !== 1 ? "s" : ""} open for voting.`, severity: "INFO", action: "Vote now" })
  if (events > 0) insights.push({ type: "GENERAL", title: "Upcoming Events", content: `${events} event${events !== 1 ? "s" : ""} on the calendar.`, severity: "INFO" })

  // Health score
  const health = Math.round((compliance + Math.min(100, paid > 0 ? 50 : 0) + (balances === 0 ? 50 : 25) + (goals.length > 0 ? 25 : 0)) / 200 * 100)

  console.timeEnd("AI: generateAssistantInsights")
  return { insights, health, compliance }
}
