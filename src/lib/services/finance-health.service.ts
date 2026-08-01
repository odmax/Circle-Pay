import { prisma } from "@/lib/prisma"
import { addDays, startOfDay } from "date-fns"

export type HealthFactor = {
  name: string
  score: number
  weight: number
  details: string
}

export type HealthResult = {
  score: number
  rating: string
  factors: HealthFactor[]
  computedAt: Date
}

export type PredictionResult = {
  endOfMonthCollection: number
  endOfMonthCollectionRate: number
  projectedCashFlow: { date: string; balance: number }[]
  budgetExhaustionDate: string | null
  expectedROI: number | null
  fundingShortfall: number
  futureOverdueCount: number
}

const RATING_THRESHOLDS = { EXCELLENT: 85, GOOD: 70, AVERAGE: 50, NEEDS_ATTENTION: 35 }

function rateScore(score: number): string {
  if (score >= RATING_THRESHOLDS.EXCELLENT) return "EXCELLENT"
  if (score >= RATING_THRESHOLDS.GOOD) return "GOOD"
  if (score >= RATING_THRESHOLDS.AVERAGE) return "AVERAGE"
  if (score >= RATING_THRESHOLDS.NEEDS_ATTENTION) return "NEEDS_ATTENTION"
  return "CRITICAL"
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}

export async function computeCircleHealthScore(circleId: string): Promise<HealthResult> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = startOfDay(now)
  const thirtyDaysAgo = addDays(todayStart, -30)

  const [
    totalPaid,
    totalPending,
    totalDue,
    totalOverdue,
    totalUpcoming,
    monthPaid,
    totalContributions,
    totalMembers,
    contributingMemberGroups,
    totalExpenses,
    totalBalance,
    outstandingBalanceCount,
    totalBudgetApproved,
    totalBudgetActual,
    totalProjectRevenue,
    totalProjectExpenses,
    totalProjectRaised,
    totalProjectROI,
    walletInflows,
    walletOutflows,
    overdueContributions,
    lateContributions,
    duplicateProofUrlCount,
    pendingApprovalsCount,
  ] = await Promise.all([
    prisma.contribution.aggregate({ where: { circleId, status: "PAID" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "PENDING" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "DUE" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "OVERDUE" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "UPCOMING" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({
      where: { circleId, status: "PAID", paymentDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.contribution.count({ where: { circleId, deletedAt: null } }),
    prisma.circleMember.count({ where: { circleId } }),
    prisma.contribution.groupBy({ by: ["userId"], where: { circleId, status: { in: ["PAID", "DUE", "OVERDUE"] }, deletedAt: null }, _count: { id: true } }),
    prisma.expense.aggregate({ where: { circleId, deletedAt: null }, _sum: { amount: true } }),
    prisma.balance.aggregate({ where: { circleId }, _sum: { amount: true } }),
    prisma.balance.count({ where: { circleId, amount: { gt: 0 } } }),
    prisma.projectBudgetCategory.aggregate({
      where: { project: { circleId }, status: "ACTIVE" },
      _sum: { approvedBudget: true },
    }),
    prisma.projectBudgetCategory.aggregate({
      where: { project: { circleId } },
      _sum: { actualCost: true },
    }),
    prisma.projectRevenue.aggregate({
      where: { circleId, status: "CONFIRMED" },
      _sum: { amount: true },
    }),
    prisma.projectExpense.aggregate({
      where: { circleId, status: { in: ["PAID", "APPROVED"] } },
      _sum: { amount: true },
    }),
    prisma.project.aggregate({ where: { circleId }, _sum: { currentAmount: true } }),
    prisma.project.aggregate({
      where: { circleId, status: { in: ["ACTIVE", "REVENUE_GENERATING", "FULLY_FUNDED"] } },
      _sum: { currentAmount: true },
    }),
    prisma.ledgerTransaction.aggregate({
      where: { circleId, type: "CREDIT", createdAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.ledgerTransaction.aggregate({
      where: { circleId, type: "DEBIT", createdAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.contribution.count({
      where: { circleId, status: { in: ["OVERDUE", "DUE"] }, deletedAt: null },
    }),
    prisma.contribution.count({
      where: {
        circleId,
        status: { in: ["DUE", "OVERDUE"] },
        deletedAt: null,
        dueDate: { lt: todayStart },
      },
    }),
    prisma.contribution.count({
      where: { circleId, deletedAt: null, proofUrl: { not: null } },
    }),
    prisma.approvalRequest.count({ where: { circleId, status: "PENDING" } }),
  ])

  const paid = Number(totalPaid._sum.amount ?? 0)
  const pending = Number(totalPending._sum.amount ?? 0)
  const due = Number(totalDue._sum.amount ?? 0)
  const overdue = Number(totalOverdue._sum.amount ?? 0)
  const upcoming = Number(totalUpcoming._sum.amount ?? 0)
  const monthPaidSum = Number(monthPaid._sum.amount ?? 0)
  const expectedThisMonth = paid + pending + due + overdue + upcoming
  const collectionRate = expectedThisMonth > 0 ? (paid / expectedThisMonth) * 100 : 0

  const totalExpenseSum = Number(totalExpenses._sum.amount ?? 0)
  const totalBalanceSum = Number(totalBalance._sum.amount ?? 0)
  const totalBudgetApprovedSum = Number(totalBudgetApproved._sum.approvedBudget ?? 0)
  const totalBudgetActualSum = Number(totalBudgetActual._sum.actualCost ?? 0)
  const totalProjectRevenueSum = Number(totalProjectRevenue._sum.amount ?? 0)
  const totalProjectExpensesSum = Number(totalProjectExpenses._sum.amount ?? 0)
  const totalProjectRaisedSum = Number(totalProjectRaised._sum.currentAmount ?? 0)
  const totalProjectROIValue = Number(totalProjectROI._sum.currentAmount ?? 0)
  const walletInflow = Number(walletInflows._sum.amount ?? 0)
  const walletOutflow = Number(walletOutflows._sum.amount ?? 0)

  const factors: HealthFactor[] = []

  const collectionScore = clamp(collectionRate)
  factors.push({ name: "Collection Rate", score: collectionScore, weight: 25, details: `${Math.round(collectionRate)}% of expected collected` })

  const latePenalty = overdueContributions > 0 ? Math.min(30, overdueContributions * 5) : 0
  const lateScore = clamp(100 - latePenalty)
  factors.push({ name: "Late Contributions", score: lateScore, weight: 15, details: `${overdueContributions} overdue, ${lateContributions} past due` })

  const outstandingPenalty = outstandingBalanceCount > 0 ? Math.min(25, outstandingBalanceCount * 5) : 0
  const outstandingScore = clamp(100 - outstandingPenalty)
  factors.push({ name: "Outstanding Balances", score: outstandingScore, weight: 10, details: `${outstandingBalanceCount} outstanding balance(s) totalling ${totalBalanceSum.toFixed(2)}` })

  const budgetAdherence = totalBudgetApprovedSum > 0
    ? clamp(((totalBudgetApprovedSum - Math.max(0, totalBudgetActualSum - totalBudgetApprovedSum)) / totalBudgetApprovedSum) * 100)
    : 100
  factors.push({ name: "Budget Adherence", score: budgetAdherence, weight: 15, details: totalBudgetApprovedSum > 0 ? `R${totalBudgetActualSum.toFixed(2)} of R${totalBudgetApprovedSum.toFixed(2)} used` : "No active budgets" })

  const revenueVsExpense = totalExpenseSum > 0
    ? clamp((totalProjectRevenueSum / (totalProjectRevenueSum + totalExpenseSum)) * 100)
    : (totalProjectRevenueSum > 0 ? 100 : 50)
  factors.push({ name: "Revenue vs Expenses", score: revenueVsExpense, weight: 10, details: `R${totalProjectRevenueSum.toFixed(2)} revenue vs R${totalExpenseSum.toFixed(2)} expenses` })

  const roiScore = totalProjectRaisedSum > 0
    ? clamp((totalProjectROIValue / totalProjectRaisedSum) * 100)
    : (totalProjectRevenueSum > 0 ? 75 : 50)
  factors.push({ name: "ROI", score: roiScore, weight: 10, details: totalProjectRaisedSum > 0 ? `${Math.round(roiScore)}% return on raised` : "No project funding data" })

  const contributingMembers = contributingMemberGroups.length
  const participationRate = totalMembers > 0 ? (contributingMembers / totalMembers) * 100 : 0
  const participationScore = clamp(participationRate)
  factors.push({ name: "Member Participation", score: participationScore, weight: 10, details: `${contributingMembers} of ${totalMembers} members active` })

  const stabilityRatio = walletInflow + walletOutflow > 0 ? (walletInflow / (walletInflow + walletOutflow)) * 100 : 50
  const stabilityScore = clamp(stabilityRatio)
  factors.push({ name: "Financial Stability", score: stabilityScore, weight: 5, details: `Inflow R${walletInflow.toFixed(2)} vs outflow R${walletOutflow.toFixed(2)}` })

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weightedSum = factors.reduce((s, f) => s + f.score * f.weight, 0)
  const score = totalWeight > 0 ? clamp(Math.round(weightedSum / totalWeight)) : 50

  return { score, rating: rateScore(score), factors, computedAt: now }
}

export async function getOrComputeHealth(circleId: string, force = false): Promise<HealthResult> {
  const existing = await prisma.circleHealthScore.findUnique({ where: { circleId } })
  const stale = existing && (Date.now() - existing.updatedAt.getTime() > 12 * 60 * 60 * 1000)
  if (existing && !stale && !force) {
    return { score: existing.score, rating: existing.rating, factors: existing.factors as HealthFactor[], computedAt: existing.computedAt }
  }
  const result = await computeCircleHealthScore(circleId)
  await prisma.circleHealthScore.upsert({
    where: { circleId },
    create: { circleId, score: result.score, rating: result.rating, factors: JSON.parse(JSON.stringify(result.factors)) as any, computedAt: result.computedAt },
    update: { score: result.score, rating: result.rating, factors: JSON.parse(JSON.stringify(result.factors)) as any, computedAt: result.computedAt, updatedAt: new Date() },
  })
  return result
}

export async function generatePredictions(circleId: string): Promise<PredictionResult> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    monthPaid,
    monthPending,
    monthDue,
    monthOverdue,
    monthUpcoming,
    prevMonthPaid,
    totalExpenses,
    budgetCategories,
    projectRevenues,
    projectExpenses,
    projectRaised,
    overdueContributions,
    upcomingContributions,
    memberCount,
    totalBalance,
  ] = await Promise.all([
    prisma.contribution.aggregate({ where: { circleId, status: "PAID", paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "PENDING", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "DUE", dueDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "OVERDUE" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({ where: { circleId, status: "UPCOMING" }, _sum: { amount: true } }),
    prisma.contribution.aggregate({
      where: { circleId, status: "PAID", paymentDate: { gte: addDays(monthStart, -30), lt: monthStart } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({ where: { circleId, deletedAt: null }, _sum: { amount: true } }),
    prisma.projectBudgetCategory.findMany({ where: { project: { circleId } }, select: { approvedBudget: true, actualCost: true, remainingBudget: true } }),
    prisma.projectRevenue.aggregate({ where: { circleId, status: "CONFIRMED" }, _sum: { amount: true } }),
    prisma.projectExpense.aggregate({ where: { circleId, status: { in: ["PAID", "APPROVED"] } }, _sum: { amount: true } }),
    prisma.project.aggregate({ where: { circleId }, _sum: { currentAmount: true } }),
    prisma.contribution.count({ where: { circleId, status: { in: ["OVERDUE", "DUE"] }, deletedAt: null } }),
    prisma.contribution.count({ where: { circleId, status: "UPCOMING", deletedAt: null } }),
    prisma.circleMember.count({ where: { circleId } }),
    prisma.balance.aggregate({ where: { circleId }, _sum: { amount: true } }),
  ])

  const paidThisMonth = Number(monthPaid._sum.amount ?? 0)
  const pendingThisMonth = Number(monthPending._sum.amount ?? 0)
  const dueThisMonth = Number(monthDue._sum.amount ?? 0)
  const overdueThisMonth = Number(monthOverdue._sum.amount ?? 0)
  const upcomingThisMonth = Number(monthUpcoming._sum.amount ?? 0)
  const prevMonthPaidSum = Number(prevMonthPaid._sum.amount ?? 0)
  const totalExpenseSum = Number(totalExpenses._sum.amount ?? 0)
  const totalProjectRevenueSum = Number(projectRevenues._sum.amount ?? 0)
  const totalProjectExpensesSum = Number(projectExpenses._sum.amount ?? 0)
  const totalProjectRaisedSum = Number(projectRaised._sum.currentAmount ?? 0)
  const totalBalanceSum = Number(totalBalance._sum.amount ?? 0)

  const expectedThisMonth = paidThisMonth + pendingThisMonth + dueThisMonth + overdueThisMonth + upcomingThisMonth
  const collectionRate = expectedThisMonth > 0 ? paidThisMonth / expectedThisMonth : 0

  const endOfMonthCollection = expectedThisMonth > 0 ? Math.round(collectionRate * expectedThisMonth) : 0
  const endOfMonthCollectionRate = Math.round(collectionRate * 100)

  const dailyOutflow = totalExpenseSum > 0 ? totalExpenseSum / 30 : 0
  const projectedCashFlow: { date: string; balance: number }[] = []
  for (let i = 0; i < 30; i++) {
    const d = addDays(todayStart, i)
    projectedCashFlow.push({ date: d.toISOString().split("T")[0]!, balance: Math.round((totalBalanceSum - dailyOutflow * i) * 100) / 100 })
  }

  const budgetExhaustionDate = (() => {
    const remainingBudget = budgetCategories.reduce((s, b) => s + Math.max(0, Number(b.remainingBudget)), 0)
    if (remainingBudget <= 0 || dailyOutflow <= 0) return null
    const daysLeft = Math.ceil(remainingBudget / dailyOutflow)
    return addDays(todayStart, daysLeft).toISOString().split("T")[0]!
  })()

  const expectedROI = totalProjectRaisedSum > 0 ? Math.round((totalProjectRevenueSum / totalProjectRaisedSum) * 100) : null

  const fundingShortfall = Math.max(0, totalProjectExpensesSum - totalProjectRevenueSum)

  const overdueRate = memberCount > 0 ? overdueContributions / memberCount : 0
  const futureOverdueCount = Math.round(upcomingContributions * overdueRate)

  return {
    endOfMonthCollection,
    endOfMonthCollectionRate,
    projectedCashFlow,
    budgetExhaustionDate,
    expectedROI,
    fundingShortfall,
    futureOverdueCount,
  }
}