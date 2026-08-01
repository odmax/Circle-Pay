import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import type {
  AIInsightType,
  AIInsightSeverity,
  AIInsightStatus,
  AIInsightCategory,
} from "@/generated/prisma"

type InsightInput = {
  type: AIInsightType
  title: string
  content: string
  severity: AIInsightSeverity
  category: AIInsightCategory
  reason: string
  recommendedAction: string
  metadata?: Record<string, unknown>
}

function fingerprint(type: AIInsightType, title: string): string {
  return `${type}:${title}`
}

export async function generateFinancialInsights(
  circleId: string,
  actorId: string
): Promise<{ insights: InsightInput[]; healthScore: number; rating: string; predictions: Record<string, unknown> }> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

  const [health, predictions, contributions, expenses, balances, goals, projects, budgets, approvals, members, proofGroups, revenue, projectExpenses, memberContributions, memberExpenses] = await Promise.all([
    import("./finance-health.service").then((m) => m.computeCircleHealthScore(circleId)),
    import("./finance-health.service").then((m) => m.generatePredictions(circleId)),
    prisma.contribution.findMany({ where: { circleId, deletedAt: null }, select: { id: true, userId: true, amount: true, status: true, dueDate: true, paymentDate: true, proofUrl: true, contributionMonth: true, periodLabel: true } }),
    prisma.expense.findMany({ where: { circleId, deletedAt: null }, select: { id: true, title: true, amount: true, category: true, expenseDate: true, paidById: true, splits: { select: { userId: true, amount: true, settled: true } } } }),
    prisma.balance.findMany({ where: { circleId, amount: { gt: 0 } }, select: { id: true, debtorId: true, creditorId: true, amount: true } }),
    prisma.goal.findMany({ where: { circleId, deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true, targetAmount: true, currentAmount: true, deadline: true } }),
    prisma.project.findMany({ where: { circleId }, select: { id: true, name: true, status: true, targetAmount: true, currentAmount: true, targetCompletionDate: true } }),
    prisma.projectBudgetCategory.findMany({ where: { project: { circleId } }, select: { id: true, projectId: true, category: true, approvedBudget: true, actualCost: true, remainingBudget: true, overBudgetPolicy: true } }),
    prisma.approvalRequest.findMany({ where: { circleId, status: "PENDING" }, select: { id: true, title: true, amount: true, type: true, expiresAt: true } }),
    prisma.circleMember.findMany({ where: { circleId }, select: { userId: true, joinedAt: true } }),
    prisma.contribution.groupBy({ by: ["proofUrl"], where: { circleId, proofUrl: { not: null } }, _count: { id: true }, having: { proofUrl: { _count: { gt: 1 } } } }),
    prisma.projectRevenue.aggregate({ where: { circleId }, _sum: { amount: true, grossAmount: true } }),
    prisma.projectExpense.aggregate({ where: { circleId }, _sum: { amount: true } }),
    prisma.contribution.groupBy({ by: ["userId"], where: { circleId, deletedAt: null, status: { in: ["PAID", "DUE", "OVERDUE"] } }, _count: { id: true } }),
    prisma.expense.groupBy({ by: ["paidById"], where: { circleId, deletedAt: null }, _count: { id: true } }),
  ])

  const insights: InsightInput[] = []

  const paidContribs = contributions.filter((c) => c.status === "PAID")
  const overdueContribs = contributions.filter((c) => c.status === "OVERDUE")
  const dueContribs = contributions.filter((c) => c.status === "DUE")
  const upcomingContribs = contributions.filter((c) => c.status === "UPCOMING")
  const totalPaid = paidContribs.reduce((s, c) => s + Number(c.amount), 0)
  const totalOverdue = overdueContribs.reduce((s, c) => s + Number(c.amount), 0)
  const totalDue = dueContribs.reduce((s, c) => s + Number(c.amount), 0)
  const totalUpcoming = upcomingContribs.reduce((s, c) => s + Number(c.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalBalance = balances.reduce((s, b) => s + Number(b.amount), 0)
  const totalRevenue = Number(revenue._sum.amount ?? 0)
  const totalProjectExpenses = Number(projectExpenses._sum.amount ?? 0)
  const memberCount = members.length
  const contributingMemberIds = new Set(paidContribs.map((c) => c.userId))

  const memberContribMap = new Map(memberContributions.map((c) => [c.userId, c._count.id]))
  const memberExpenseMap = new Map(memberExpenses.map((e) => [e.paidById, e._count.id]))

  // S1: MISSED_PAYMENT_RISK
  const highRiskMembers: string[] = []
  for (const m of members) {
    const contribCount = memberContribMap.get(m.userId) ?? 0
    const expenseCount = memberExpenseMap.get(m.userId) ?? 0
    const hasAnyActivity = contribCount > 0 || expenseCount > 0
    if (!hasAnyActivity && m.joinedAt < thirtyDaysAgo) {
      highRiskMembers.push(m.userId)
    }
  }
  if (highRiskMembers.length >= 2) {
    insights.push({
      type: "INACTIVE_MEMBER",
      title: `${highRiskMembers.length} inactive members detected`,
      content: `${highRiskMembers.length} member(s) joined 30+ days ago with no contributions or expenses.`,
      severity: highRiskMembers.length >= 4 ? "WARNING" : "INFO",
      category: "RISK",
      reason: `${highRiskMembers.length} member(s) have been inactive since joining.`,
      recommendedAction: `Send re-engagement messages to ${highRiskMembers.length} inactive member${highRiskMembers.length > 1 ? "s" : ""}`,
      metadata: { memberIds: highRiskMembers, count: highRiskMembers.length },
    })
  }

  // S2: CONTRIBUTION_TREND
  const paidThisMonth = paidContribs.filter((c) => c.paymentDate && c.paymentDate >= monthStart).length
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const paidPrevMonth = contributions.filter(
    (c) => c.paymentDate && c.paymentDate >= prevMonthStart && c.paymentDate < monthStart && c.status === "PAID"
  ).length
  if (paidPrevMonth > 0 && paidThisMonth < paidPrevMonth * 0.7) {
    const decline = Math.round(((paidPrevMonth - paidThisMonth) / paidPrevMonth) * 100)
    insights.push({
      type: "CONTRIBUTION_TREND",
      title: "Contribution trend declining",
      content: `Paid contributions dropped ${decline}% from ${paidPrevMonth} to ${paidThisMonth} month-over-month.`,
      severity: decline >= 40 ? "WARNING" : "INFO",
      category: "RISK",
      reason: `Month-over-month contribution count fell from ${paidPrevMonth} to ${paidThisMonth}.`,
      recommendedAction: "Review upcoming contributions and send reminders to members",
      metadata: { paidThisMonth, paidPrevMonth, decline },
    })
  } else if (paidPrevMonth > 0 && paidThisMonth > paidPrevMonth * 1.2) {
    const growth = Math.round(((paidThisMonth - paidPrevMonth) / paidPrevMonth) * 100)
    insights.push({
      type: "CONTRIBUTION_TREND",
      title: "Contribution trend improving",
      content: `Paid contributions grew ${growth}% from ${paidPrevMonth} to ${paidThisMonth} month-over-month.`,
      severity: "SUCCESS",
      category: "OPPORTUNITY",
      reason: `Month-over-month contribution count rose from ${paidPrevMonth} to ${paidThisMonth}.`,
      recommendedAction: "Maintain current contribution cadence and consider increasing targets",
      metadata: { paidThisMonth, paidPrevMonth, growth },
    })
  }

  // S3: SPENDING_ANOMALY
  const expenseByMonth = new Map<string, number>()
  for (const e of expenses) {
    const monthKey = e.expenseDate.toISOString().slice(0, 7)
    expenseByMonth.set(monthKey, (expenseByMonth.get(monthKey) || 0) + Number(e.amount))
  }
  const monthlyTotals = [...expenseByMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (monthlyTotals.length >= 2) {
    const avgMonthly = monthlyTotals.slice(0, -1).reduce((s, [, v]) => s + v, 0) / (monthlyTotals.length - 1)
    const latestMonth = monthlyTotals[monthlyTotals.length - 1][1]
    if (avgMonthly > 0 && latestMonth > avgMonthly * 1.5 && latestMonth > 100) {
      const spikePct = Math.round(((latestMonth - avgMonthly) / avgMonthly) * 100)
      insights.push({
        type: "SPENDING_ANOMALY",
        title: `Expense spike detected (${spikePct}% above average)`,
        content: `Latest month expenses R${latestMonth.toFixed(2)} vs average R${avgMonthly.toFixed(2)} across ${monthlyTotals.length - 1} prior months.`,
        severity: spikePct >= 100 ? "WARNING" : "INFO",
        category: "RISK",
        reason: `Expenses in the latest month are ${spikePct}% higher than the prior monthly average.`,
        recommendedAction: "Review recent expenses for necessity and approve/dispute outliers",
        metadata: { latestMonth, avgMonthly, spikePct },
      })
    }
  }

  // S4: BUDGET_OVERRUN
  const overBudget = budgets.filter((b) => Number(b.actualCost) > Number(b.approvedBudget) && Number(b.approvedBudget) > 0)
  if (overBudget.length > 0) {
    const worst = overBudget.sort((a, b) => Number(b.actualCost) - Number(b.approvedBudget) - (Number(a.actualCost) - Number(a.approvedBudget)))[0]
    const overagePct = Math.round(((Number(worst.actualCost) - Number(worst.approvedBudget)) / Number(worst.approvedBudget)) * 100)
    insights.push({
      type: "BUDGET_OVERRUN",
      title: `Budget overrun in ${worst.category} (${overagePct}% over)`,
      content: `Category "${worst.category}" has R${Number(worst.actualCost).toFixed(2)} actual vs R${Number(worst.approvedBudget).toFixed(2)} approved.`,
      severity: overagePct >= 50 ? "CRITICAL" : "WARNING",
      category: "RISK",
      reason: `Budget category "${worst.category}" exceeds approved budget by ${overagePct}%.`,
      recommendedAction: overagePct >= 50 ? "Freeze spending in this category and review all line items" : "Review upcoming expenses and reallocate if needed",
      metadata: { category: worst.category, approvedBudget: Number(worst.approvedBudget), actualCost: Number(worst.actualCost), overagePct, policy: worst.overBudgetPolicy },
    })
  }

  // S5: REVENUE_DECLINE
  if (monthlyTotals.length >= 2) {
    const prevRev = monthlyTotals[monthlyTotals.length - 2][1]
    const latestRev = monthlyTotals[monthlyTotals.length - 1][1]
    if (prevRev > 0 && latestRev < prevRev * 0.6) {
      const decline = Math.round(((prevRev - latestRev) / prevRev) * 100)
      insights.push({
        type: "REVENUE_DECLINE",
        title: `Revenue declined ${decline}% month-over-month`,
        content: `Expenses fell from R${prevRev.toFixed(2)} to R${latestRev.toFixed(2)}.`,
        severity: decline >= 50 ? "WARNING" : "INFO",
        category: "RISK",
        reason: `Expenses dropped ${decline}% from R${prevRev.toFixed(2)} to R${latestRev.toFixed(2)}.`,
        recommendedAction: "Investigate revenue sources and consider new funding streams",
        metadata: { prevExpenses: prevRev, latestExpenses: latestRev, decline },
      })
    }
  }

  // S6: OUTSTANDING_APPROVALS
  if (approvals.length > 0) {
    const expiredApprovals = approvals.filter((a) => a.expiresAt && a.expiresAt < now)
    insights.push({
      type: "OUTSTANDING_APPROVAL",
      title: `${approvals.length} approval request${approvals.length > 1 ? "s" : ""} pending`,
      content: expiredApprovals.length > 0 ? `${expiredApprovals.length} expired, ${approvals.length - expiredApprovals.length} still active.` : `All ${approvals.length} requests are active.`,
      severity: expiredApprovals.length > 0 ? "WARNING" : "INFO",
      category: "GENERAL",
      reason: `${approvals.length} approval request(s) pending; ${expiredApprovals.length} expired.`,
      recommendedAction: expiredApprovals.length > 0 ? "Review and resolve expired approvals immediately" : "Review pending approvals this week",
      metadata: { pendingCount: approvals.length, expiredCount: expiredApprovals.length },
    })
  }

  // S7: HIGH_RISK_PROJECTS
  const highRiskProjects = projects.filter(
    (p) =>
      p.status === "SUSPENDED" ||
      p.status === "FAILED" ||
      p.status === "CANCELLED" ||
      (p.targetCompletionDate && p.targetCompletionDate < now && p.status !== "COMPLETED")
  )
  if (highRiskProjects.length > 0) {
    insights.push({
      type: "HIGH_RISK_PROJECT",
      title: `${highRiskProjects.length} high-risk project${highRiskProjects.length > 1 ? "s" : ""}`,
      content: highRiskProjects.map((p) => `"${p.name}" (${p.status})`).join("; "),
      severity: highRiskProjects.some((p) => p.status === "FAILED" || p.status === "CANCELLED") ? "CRITICAL" : "WARNING",
      category: "RISK",
      reason: `Projects in suspended/failed/cancelled status or past completion deadline without completion.`,
      recommendedAction: "Review project status and decide on continuation or cancellation",
      metadata: { projectIds: highRiskProjects.map((p) => p.id), statuses: highRiskProjects.map((p) => p.status) },
    })
  }

  // S8: LOW_CASH_FLOW
  const totalInflows = totalPaid + totalRevenue
  const totalOutflows = totalExpenses + totalProjectExpenses
  if (totalOutflows > 0 && totalInflows < totalOutflows * 0.5) {
    insights.push({
      type: "LOW_CASH_FLOW",
      title: "Cash flow is critically low",
      content: `Inflows (R${totalInflows.toFixed(2)}) are less than 50% of outflows (R${totalOutflows.toFixed(2)}).`,
      severity: "CRITICAL",
      category: "RISK",
      reason: `Net cash flow is negative: R${totalInflows.toFixed(2)} in vs R${totalOutflows.toFixed(2)} out.`,
      recommendedAction: "Request additional capital or delay discretionary spending",
      metadata: { inflows: totalInflows, outflows: totalOutflows, ratio: Math.round((totalInflows / totalOutflows) * 100) },
    })
  } else if (totalBalance < 0 && Math.abs(Number(totalBalance)) > totalExpenses * 0.3) {
    insights.push({
      type: "LOW_CASH_FLOW",
      title: "Negative cash position",
      content: `Circle wallet balance is negative (R${Number(totalBalance).toFixed(2)}) with R${totalExpenses.toFixed(2)} in expenses.`,
      severity: "WARNING",
      category: "RISK",
      reason: `Wallet balance is negative while expenses are ongoing.`,
      recommendedAction: "Request additional capital or reduce expenses",
      metadata: { balance: Number(totalBalance), expenses: totalExpenses },
    })
  }

  // S9: DUPLICATE_PROOF
  const duplicateProofs = proofGroups.filter((g) => g._count.id > 1)
  if (duplicateProofs.length > 0) {
    insights.push({
      type: "DUPLICATE_PROOF",
      title: `${duplicateProofs.length} duplicate proof submission${duplicateProofs.length > 1 ? "s" : ""} detected`,
      content: `Same proof file submitted for multiple contributions.`,
      severity: "WARNING",
      category: "RISK",
      reason: `${duplicateProofs.length} proof URL(s) are linked to more than one contribution, indicating potential duplicate submissions.`,
      recommendedAction: "Verify each proof and reject duplicates if invalid",
      metadata: { duplicateCount: duplicateProofs.length },
    })
  }

  // S10: OUTSTANDING_BALANCES
  if (balances.length > 0 && totalBalance > 0) {
    insights.push({
      type: "MEMBER_RISK",
      title: `${balances.length} outstanding balance(s) need settling`,
      content: `Total outstanding: R${totalBalance.toFixed(2)} across ${balances.length} balance(s).`,
      severity: balances.length >= 3 ? "WARNING" : "INFO",
      category: "RISK",
      reason: `${balances.length} member balance(s) remain unsettled totalling R${totalBalance.toFixed(2)}.`,
      recommendedAction: "Send settlement reminders to members with outstanding balances",
      metadata: { balanceCount: balances.length, totalOutstanding: totalBalance },
    })
  }

  // S11: GOAL_FORECAST
  for (const g of goals) {
    const pct = Number(g.targetAmount) > 0 ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100 : 0
    if (pct >= 90 && pct < 100) {
      insights.push({
        type: "GOAL_FORECAST",
        title: `Goal "${g.name}" near completion (${Math.round(pct)}%)`,
        content: `Only R${(Number(g.targetAmount) - Number(g.currentAmount)).toFixed(2)} remaining to reach target.`,
        severity: "SUCCESS",
        category: "OPPORTUNITY",
        reason: `Goal "${g.name}" is at ${Math.round(pct)}% of target.`,
        recommendedAction: "Consider allocating additional funds to close out this goal",
        metadata: { goalId: g.id, progress: Math.round(pct), remaining: Number(g.targetAmount) - Number(g.currentAmount) },
      })
    }
  }

  // Dedup: keep only latest insight per fingerprint
  const existing = await prisma.aIInsight.findMany({
    where: { circleId, status: { in: ["ACTIVE", "READ"] as AIInsightStatus[] } },
    select: { id: true, type: true, title: true },
  })
  const existingFingerprints = new Set(existing.map((e) => fingerprint(e.type, e.title)))

  const newInsights = insights.filter((i) => !existingFingerprints.has(fingerprint(i.type, i.title)))

  return { insights: newInsights, healthScore: health.score, rating: health.rating, predictions: predictions as Record<string, unknown> }
}

export async function runFinancialAnalysis(circleId: string, actorId: string) {
  const { insights, healthScore, rating, predictions } = await generateFinancialInsights(circleId, actorId)

  await createAuditLog({
    userId: actorId,
    circleId,
    action: "AI_ANALYSIS_RUN",
    entityType: "CircleHealthScore",
    entityId: circleId,
    oldValues: null,
    newValues: { healthScore, rating, insightCount: insights.length, predictionKeys: Object.keys(predictions) },
  })

  const ownerAdmins = await prisma.circleMember.findMany({
    where: { circleId, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  })
  const ownerAdminIds = ownerAdmins.map((m) => m.userId)

  for (const insight of insights) {
    const created = await prisma.aIInsight.create({
      data: {
        circleId,
        type: insight.type,
        title: insight.title,
        content: insight.content,
        severity: insight.severity,
        category: insight.category,
        status: "ACTIVE",
        reason: insight.reason,
        recommendedAction: insight.recommendedAction,
        metadata: (insight.metadata ?? undefined) as any,
      },
    })

    await createAuditLog({
      userId: actorId,
      circleId,
      action: "INSIGHT_GENERATED",
      entityType: "AIInsight",
      entityId: created.id,
      oldValues: null,
      newValues: { type: insight.type, severity: insight.severity, title: insight.title, category: insight.category },
    })

    if (insight.severity === "CRITICAL" || insight.severity === "WARNING") {
      for (const adminId of ownerAdminIds) {
        await notifyCircleMembers(circleId, adminId, {
          type: "FINANCIAL_RISK",
          title: `Financial Alert: ${insight.title}`,
          message: insight.reason,
          link: `/circles/${circleId}/assistant`,
        })
      }
    }
  }

  return { insights, healthScore, rating, predictions }
}