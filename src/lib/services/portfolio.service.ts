import { prisma } from "@/lib/prisma"
import { getProjectInvestmentSummaries, type InvestmentProjectSummary } from "@/lib/services/project-investment.service"
import {
  computeMonthlySeries,
  computeRoi,
  computeRoiTrend,
  computePortfolioAlerts,
  type PortfolioAlert,
  type MonthlyPoint,
} from "@/lib/services/project-investment-metrics"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface PortfolioProjectRow {
  id: string
  name: string
  status: string
  health: InvestmentProjectSummary["health"]
  fundingPercent: number
  capital: number
  currentValue: number
  profit: number
  roi: number
  investors: number
  myOwnershipPercent: number
  myCapital: number
  nextDistribution: InvestmentProjectSummary["nextDistribution"]
  openRound: boolean
  pendingApprovals: number
}

export interface CirclePortfolio {
  currency: string
  summary: {
    totalCapitalInvested: number
    portfolioValue: number
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    overallRoi: number
    activeProjects: number
    totalInvestors: number
    pendingApprovals: number
    upcomingDistributions: number
  }
  projects: PortfolioProjectRow[]
  performance: {
    valueTrend: MonthlyPoint[]
    roiTrend: Array<{ key: string; label: string; roi: number; net: number }>
    capitalAllocation: Array<{ projectId: string; name: string; capital: number; color: string }>
    comparison: Array<{ id: string; name: string; roi: number; profit: number; fundingPercent: number; health: PortfolioProjectRow["health"] }>
    best: PortfolioProjectRow | null
    worst: PortfolioProjectRow | null
  }
  myPosition: {
    invested: number
    currentValue: number
    profitLoss: number
    roi: number
    distributionsReceived: number
    pendingDistributions: number
    activeInvestments: number
    ownership: Array<{ projectId: string; name: string; percent: number; invested: number }>
  }
  upcomingDistributions: Array<{ id: string; projectId: string; projectName: string; name: string; amount: number; date: string; status: string }>
  alerts: PortfolioAlert[]
  activity: Array<{ id: string; projectId: string | null; projectName: string | null; type: string; title: string; description: string | null; actorName: string | null; createdAt: string }>
}

const CHART_PALETTE = ["#16a34a", "#7c3aed", "#2563eb", "#f59e0b", "#ef4444", "#0891b2", "#db2777", "#65a30d"]

interface ActivityRow {
  id: string
  type: string
  title: string
  description: string | null
  userId: string | null
  createdAt: Date
  project: { id: string; name: string } | null
}

export async function getCirclePortfolio(circleId: string, viewerUserId: string, currency = "ZAR"): Promise<CirclePortfolio> {
  const summaries = await getProjectInvestmentSummaries(circleId, viewerUserId)
  const projectIds = summaries.map((p) => p.id)

  // Extra batch data (no per-project loops): dated financials for trends/alerts,
  // budgets for over-budget alerts, upcoming distributions, viewer distribution
  // items, and the unified activity feed.
  const [revenues, expenses, budgets, distributions, viewerDistItems] = await Promise.all([
    projectIds.length
      ? prisma.projectRevenue.findMany({ where: { projectId: { in: projectIds }, status: "CONFIRMED" }, select: { projectId: true, amount: true, revenueDate: true } })
      : Promise.resolve([] as Array<{ projectId: string; amount: unknown; revenueDate: Date | null }>),
    projectIds.length
      ? prisma.projectExpense.findMany({ where: { projectId: { in: projectIds }, status: "PAID" }, select: { projectId: true, amount: true, expenseDate: true } })
      : Promise.resolve([] as Array<{ projectId: string; amount: unknown; expenseDate: Date | null }>),
    projectIds.length
      ? prisma.projectBudgetCategory.findMany({ where: { projectId: { in: projectIds } } })
      : Promise.resolve([] as Array<{ projectId: string; status: string; variance: unknown }>),
    projectIds.length
      ? prisma.projectDistribution.findMany({ where: { projectId: { in: projectIds }, status: { in: ["DRAFT", "APPROVED"] } } })
      : Promise.resolve([] as Array<{ id: string; projectId: string; name: string; totalProfit: unknown; distributionDate: Date | null; createdAt: Date; status: string }>),
    projectIds.length
      ? prisma.projectDistribution.findMany({
          where: { projectId: { in: projectIds }, items: { some: { userId: viewerUserId } } },
          select: { items: { where: { userId: viewerUserId }, select: { status: true, profitShare: true, paidAt: true } } },
        })
      : Promise.resolve([] as Array<{ items: Array<{ status: string; profitShare: unknown; paidAt: Date | null }> }>),
  ])

  let activities: ActivityRow[] = []
  if (projectIds.length) {
    activities = await prisma.projectActivity.findMany({
      where: { projectId: { in: projectIds } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }) as unknown as ActivityRow[]
  }

  // ProjectActivity.userId is a loose string (no relation) — resolve actor names in one batch.
  const activityActorIds = Array.from(new Set(activities.map((a) => a.userId).filter((x): x is string => !!x)))
  const activityActors = activityActorIds.length
    ? await prisma.user.findMany({ where: { id: { in: activityActorIds } }, select: { id: true, name: true } })
    : []
  const actorNameById = new Map(activityActors.map((u) => [u.id, u.name]))

  // ── Circle portfolio summary (reuses the exact per-project metric engine) ──
  const totalCapitalInvested = summaries.reduce((s, p) => s + p.capitalInvested, 0)
  const portfolioValue = summaries.reduce((s, p) => s + p.currentValue, 0)
  const totalRevenue = summaries.reduce((s, p) => s + p.revenue, 0)
  const totalExpenses = summaries.reduce((s, p) => s + p.expenses, 0)
  const netProfit = summaries.reduce((s, p) => s + p.netProfit, 0)
  const overallRoi = computeRoi(netProfit, totalCapitalInvested)
  const activeProjects = summaries.filter((p) => p.tags.includes("active")).length
  const investorCount = summaries.reduce((s, p) => s + p.investors, 0)
  const pendingApprovals = summaries.reduce((s, p) => s + p.pendingApprovals, 0)

  const upcomingDistributions = distributions.map((d) => ({
    id: d.id,
    projectId: d.projectId,
    projectName: summaries.find((p) => p.id === d.projectId)?.name || "Project",
    name: d.name,
    amount: asNum(d.totalProfit),
    date: new Date(d.distributionDate || d.createdAt).toISOString(),
    status: d.status,
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // ── Performance series (batch + pure metrics, no parallel calculations) ──
  const monthly = computeMonthlySeries(
    revenues.map((r) => ({ date: r.revenueDate || undefined, amount: asNum(r.amount) })),
    expenses.map((e) => ({ date: e.expenseDate || undefined, amount: asNum(e.amount) })),
  )
  const valueTrend = monthly
  const roiTrend = computeRoiTrend(monthly, totalCapitalInvested)

  const capitalAllocation = summaries.map((p, i) => ({
    projectId: p.id,
    name: p.name,
    capital: p.capitalInvested,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  })).filter((a) => a.capital > 0)

  const rows: PortfolioProjectRow[] = summaries.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    health: p.health,
    fundingPercent: p.fundingPercent,
    capital: p.capitalInvested,
    currentValue: p.currentValue,
    profit: p.netProfit,
    roi: p.roi,
    investors: p.investors,
    myOwnershipPercent: p.myOwnershipPercent,
    myCapital: p.myCapital,
    nextDistribution: p.nextDistribution,
    openRound: p.openRound,
    pendingApprovals: p.pendingApprovals,
  }))

  const sortable = rows.filter((p) => p.capital > 0 || p.roi !== 0)
  const best = sortable.length ? [...sortable].sort((a, b) => b.roi - a.roi)[0] : null
  const worst = sortable.length ? [...sortable].sort((a, b) => a.roi - b.roi)[0] : null

  const comparison = rows
    .map((p) => ({ id: p.id, name: p.name, roi: p.roi, profit: p.profit, fundingPercent: p.fundingPercent, health: p.health }))
    .sort((a, b) => b.roi - a.roi)

  // ── My investment position (only the viewer's own data) ──
  const myInvested = summaries.reduce((s, p) => s + p.myCapital, 0)
  const myValue = summaries.reduce((s, p) => s + (p.currentValue * p.myOwnershipPercent) / 100, 0)
  const myProfitLoss = summaries.reduce((s, p) => s + (p.netProfit * p.myOwnershipPercent) / 100, 0)
  const myRoi = computeRoi(myProfitLoss, myInvested)
  const myOwnership = summaries
    .filter((p) => p.myOwnershipPercent > 0 || p.myCapital > 0)
    .map((p) => ({ projectId: p.id, name: p.name, percent: p.myOwnershipPercent, invested: p.myCapital }))
  const terminal = ["COMPLETED", "CLOSED", "CANCELLED", "FAILED", "ARCHIVED"]
  const activeInvestments = myOwnership.filter((o) => {
    const p = summaries.find((x) => x.id === o.projectId)
    return p ? !terminal.includes(p.status) : true
  }).length

  const distItems = viewerDistItems.flatMap((d) => d.items)
  const distributionsReceived = distItems.filter((i) => i.status === "PAID").reduce((s, i) => s + asNum(i.profitShare), 0)
  const pendingDistributions = distItems.filter((i) => i.status === "APPROVED" || i.status === "DRAFT").reduce((s, i) => s + asNum(i.profitShare), 0)

  // ── Alerts (deterministic, aligned with project health tiers — pure engine) ──
  const overBudgetProjects = new Map<string, string>()
  for (const b of budgets) {
    if (b.status === "OVER_BUDGET" || asNum(b.variance) < 0) overBudgetProjects.set(b.projectId, "OVER_BUDGET")
  }
  const alerts: PortfolioAlert[] = computePortfolioAlerts({
    projects: summaries.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      fundingPercent: p.fundingPercent,
      funded: p.funded,
      target: p.target,
      netProfit: p.netProfit,
      revenue: p.revenue,
      expenses: p.expenses,
      pendingApprovals: p.pendingApprovals,
    })),
    overBudgetProjectIds: Array.from(overBudgetProjects.keys()),
    upcomingDistributions: upcomingDistributions.map((d) => ({ id: d.id, projectId: d.projectId, name: d.name, amount: d.amount, status: d.status })),
    monthly,
  })

  // ── Unified activity feed ──
  const activity = activities.map((a) => ({
    id: a.id,
    projectId: a.project?.id ?? null,
    projectName: a.project?.name ?? null,
    type: a.type,
    title: a.title,
    description: a.description ?? null,
    actorName: a.userId ? actorNameById.get(a.userId) ?? null : null,
    createdAt: a.createdAt.toISOString(),
  }))

  return {
    currency,
    summary: {
      totalCapitalInvested,
      portfolioValue,
      totalRevenue,
      totalExpenses,
      netProfit,
      overallRoi,
      activeProjects,
      totalInvestors: investorCount,
      pendingApprovals,
      upcomingDistributions: upcomingDistributions.length,
    },
    projects: rows,
    performance: { valueTrend, roiTrend, capitalAllocation, comparison, best, worst },
    myPosition: {
      invested: myInvested,
      currentValue: Math.round(myValue * 100) / 100,
      profitLoss: Math.round(myProfitLoss * 100) / 100,
      roi: myRoi,
      distributionsReceived,
      pendingDistributions,
      activeInvestments,
      ownership: myOwnership,
    },
    upcomingDistributions,
    alerts,
    activity,
  }
}