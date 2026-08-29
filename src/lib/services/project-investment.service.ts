import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"
import {
  computeFundingProgress,
  computeMonthlySeries,
  computeOwnershipPercent,
  computeProjectHealth,
  computeRoi,
  computeRoiTrend,
  projectFilterTags,
  type ProjectFilterTag,
  type ProjectHealth,
} from "@/lib/services/project-investment-metrics"

export interface NextDistribution {
  id: string
  name: string
  amount: number
  date: string
  status: string
}

export interface InvestmentProjectSummary {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  type: string
  visibility: string
  coverImage: string | null
  color: string | null
  createdAt: string
  updatedAt: string
  projectOwnerName: string | null
  target: number
  funded: number
  fundingPercent: number
  gap: number
  capitalInvested: number
  investors: number
  currentValue: number
  revenue: number
  expenses: number
  netProfit: number
  roi: number
  health: ProjectHealth
  tags: ProjectFilterTag[]
  myCapital: number
  myOwnershipPercent: number
  pendingApprovals: number
  openRound: boolean
  nextDistribution: NextDistribution | null
  lastActivity: { id: string; title: string; createdAt: string } | null
}

interface ProjectRow {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  type: string
  visibility: string
  coverImage: string | null
  color: string | null
  targetAmount: unknown
  currentAmount: unknown
  createdAt: Date
  updatedAt: Date
  createdBy?: { name?: string | null } | null
}

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ─── Project List ───────────────────────────────────────────

export async function getProjectInvestmentSummaries(circleId: string, viewerUserId: string): Promise<InvestmentProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { circleId, status: { not: "ARCHIVED" } },
    include: { createdBy: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  })
  if (projects.length === 0) return []
  const ids = projects.map((p) => p.id)

  const [contribs, expenses, revenues, assets, distributions, lastActivities, openRounds, pendingCapTxs, pendingExpenses] = await Promise.all([
    prisma.projectContribution.findMany({ where: { projectId: { in: ids }, status: "CONFIRMED" } }),
    prisma.projectExpense.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, status: true, amount: true } }),
    prisma.projectRevenue.findMany({ where: { projectId: { in: ids }, status: "CONFIRMED" }, select: { projectId: true, amount: true } }),
    prisma.projectAsset.findMany({ where: { projectId: { in: ids }, currentValue: { not: null }, status: { notIn: ["SOLD", "DISPOSED"] } }, select: { projectId: true, currentValue: true } }),
    prisma.projectDistribution.findMany({ where: { projectId: { in: ids }, status: { notIn: ["CANCELLED", "PAID"] } }, orderBy: { createdAt: "desc" } }),
    prisma.projectActivity.findMany({ where: { projectId: { in: ids } }, orderBy: { createdAt: "desc" } }),
    prisma.projectFundingRound.findMany({ where: { projectId: { in: ids }, status: "OPEN" }, select: { projectId: true } }),
    prisma.projectCapitalTransaction.findMany({ where: { projectId: { in: ids }, status: { in: ["PENDING", "SUBMITTED"] } }, select: { projectId: true } }),
    prisma.projectExpense.findMany({ where: { projectId: { in: ids }, status: "PENDING" }, select: { projectId: true } }),
  ])

  // Bucket once, reuse per project.
  const contribsByProject = groupBy(contribs, "projectId")
  const expensesByProject = groupBy(expenses, "projectId")
  const revenuesByProject = groupBy(revenues, "projectId")
  const assetsByProject = groupBy(assets, "projectId")
  const pendingCapByProject = new Set(pendingCapTxs.map((t) => t.projectId))
  const pendingExpByProject = new Set(pendingExpenses.map((e) => e.projectId))
  const openRoundProjects = new Set(openRounds.map((r) => r.projectId))
  const lastActivityByProject = new Map<string, typeof lastActivities[number]>()
  for (const a of lastActivities) if (!lastActivityByProject.has(a.projectId)) lastActivityByProject.set(a.projectId, a)
  const nextDistByProject = new Map<string, typeof distributions[number]>()
  for (const d of distributions) if (!nextDistByProject.has(d.projectId)) nextDistByProject.set(d.projectId, d)

  return projects.map((p) => summarizeProject(p, {
    contribs: contribsByProject.get(p.id) || [],
    expenses: expensesByProject.get(p.id) || [],
    revenues: revenuesByProject.get(p.id) || [],
    assets: assetsByProject.get(p.id) || [],
    pendingApprovals: (pendingCapByProject.has(p.id) ? 1 : 0) + (pendingExpByProject.has(p.id) ? 1 : 0),
    openRound: openRoundProjects.has(p.id),
    lastActivity: lastActivityByProject.get(p.id) || null,
    nextDistribution: nextDistByProject.get(p.id) || null,
  }, viewerUserId))
}

interface SummarizeInput {
  contribs: Array<{ userId: string; amount: unknown }>
  expenses: Array<{ status: string; amount: unknown }>
  revenues: Array<{ amount: unknown }>
  assets: Array<{ currentValue: unknown }>
  pendingApprovals: number
  openRound: boolean
  lastActivity: { id: string; title: string; createdAt: Date } | null
  nextDistribution: { id: string; name: string; totalProfit: unknown; distributionDate: Date | null; createdAt: Date; status: string } | null
}

function summarizeProject(p: ProjectRow, input: SummarizeInput, viewerUserId: string): InvestmentProjectSummary {
  const contribSum = input.contribs.reduce((s, c) => s + asNum(c.amount), 0)
  const funded = contribSum > 0 ? contribSum : asNum(p.currentAmount)
  const progress = computeFundingProgress(funded, asNum(p.targetAmount))
  const revenue = input.revenues.reduce((s, r) => s + asNum(r.amount), 0)
  const expenses = input.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + asNum(e.amount), 0)
  const currentValue = input.assets.reduce((s, a) => s + asNum(a.currentValue), 0)
  const realProfit = Math.round((revenue + currentValue - funded - expenses) * 100) / 100
  const roi = computeRoi(realProfit, funded)
  const investors = new Set(input.contribs.map((c) => c.userId)).size
  const myCapital = input.contribs.filter((c) => c.userId === viewerUserId).reduce((s, c) => s + asNum(c.amount), 0)
  const myOwnershipPercent = computeOwnershipPercent(myCapital, funded)
  const hasOverBudget = false

  let nextDistribution: NextDistribution | null = null
  if (input.nextDistribution) {
    nextDistribution = {
      id: input.nextDistribution.id,
      name: input.nextDistribution.name,
      amount: asNum(input.nextDistribution.totalProfit),
      date: new Date(input.nextDistribution.distributionDate || input.nextDistribution.createdAt).toISOString(),
      status: input.nextDistribution.status,
    }
  }

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    status: p.status,
    type: p.type,
    visibility: p.visibility,
    coverImage: p.coverImage,
    color: p.color,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    projectOwnerName: p.createdBy?.name || null,
    target: progress.target,
    funded,
    fundingPercent: progress.percent,
    gap: progress.gap,
    capitalInvested: funded,
    investors,
    currentValue,
    revenue,
    expenses,
    netProfit: realProfit,
    roi,
    health: computeProjectHealth({ status: p.status, fundingPercent: progress.percent, pendingApprovals: input.pendingApprovals, netProfit: realProfit, expenses, hasOverBudget }),
    tags: projectFilterTags({ status: p.status, netProfit: realProfit, fundingPercent: progress.percent }),
    myCapital,
    myOwnershipPercent,
    pendingApprovals: input.pendingApprovals,
    openRound: input.openRound,
    nextDistribution,
    lastActivity: input.lastActivity
      ? { id: input.lastActivity.id, title: input.lastActivity.title, createdAt: input.lastActivity.createdAt.toISOString() }
      : null,
  }
}

function groupBy<T extends { projectId: string }>(rows: T[], key: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const id = String(r[key])
    const arr = map.get(id) || []
    arr.push(r)
    map.set(id, arr)
  }
  return map
}

// ─── Project Overview Dashboard ─────────────────────────────

export interface InvestmentDashboard {
  project: {
    id: string
    name: string
    description: string | null
    status: string
    type: string
    coverImage: string | null
    color: string | null
    createdAt: string
    projectOwnerName: string | null
  }
  summary: {
    funded: number
    target: number
    fundingPercent: number
    capitalInvested: number
    investors: number
    currentValue: number
    revenue: number
    expenses: number
    netProfit: number
    roi: number
    assetPurchaseCost: number
    pendingApprovals: number
    financeHealth: {
      totalApproved: number
      totalPaid: number
      totalPending: number
      totalDrafts: number
      remainingBudget: number
      overBudgetCount: number
    }
  }
  health: ProjectHealth
  nextDistribution: NextDistribution | null
  fundingRounds: Array<{ id: string; name: string; targetAmount: number; currentAmount: number; status: string; allocationMethod: string; dueDate: string | null }>
  ownership: Array<{ userId: string; name: string; email: string; amount: number; percent: number }>
  monthly: Array<{ key: string; label: string; revenue: number; expense: number; net: number }>
  roiTrend: Array<{ key: string; label: string; roi: number; net: number }>
  assets: Array<{ id: string; name: string; type: string; status: string; purchaseAmount: number | null; currentValue: number | null }>
  revenueRecords: Array<{ id: string; type: string; amount: number; status: string; createdAt: string }>
  expenseRecords: Array<{ id: string; title: string; category: string; amount: number; status: string; createdAt: string }>
  pendingApprovalItems: Array<{ kind: "capital" | "expense"; id: string; title: string; amount: number; createdAt: string }>
  myPortfolio: {
    invested: number
    ownershipPercent: number
    currentValue: number
    profitLoss: number
    roi: number
    distributionsReceived: number
    pendingDistributions: number
    history: Array<{ id: string; amount: number; status: string; createdAt: string; reference: string | null }>
    distributions: Array<{ id: string; name: string; amount: number; status: string; date: string }>
  }
  activity: Array<{ id: string; type: string; title: string; description: string | null; userId: string | null; createdAt: string }>
}

export async function getProjectInvestmentDashboard(
  projectId: string,
  circleId: string,
  viewerUserId: string,
): Promise<InvestmentDashboard> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { createdBy: { select: { name: true } } },
  })
  if (!project) throw new Error("Project not found")

  const [contribs, expenses, revenues, assets, rounds, budgets, pendingCapTxs, activity, distributions] = await Promise.all([
    prisma.projectContribution.findMany({ where: { projectId, status: "CONFIRMED" }, include: { user: { select: { id: true, name: true, email: true } } } }),
    prisma.projectExpense.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.projectRevenue.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.projectAsset.findMany({ where: { projectId } }),
    prisma.projectFundingRound.findMany({ where: { projectId }, include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.projectBudgetCategory.findMany({ where: { projectId } }),
    prisma.projectCapitalTransaction.findMany({ where: { projectId, status: { in: ["PENDING", "SUBMITTED"] } }, include: { participant: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.projectActivity.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.projectDistribution.findMany({ where: { projectId }, include: { items: { where: { userId: viewerUserId }, select: { status: true, profitShare: true, paidAt: true, createdAt: true } } }, orderBy: { createdAt: "desc" } }),
  ])

  const funded = contribs.reduce((s, c) => s + asNum(c.amount), 0)
  const progress = computeFundingProgress(funded, asNum(project.targetAmount))
  const revenue = revenues.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + asNum(r.amount), 0)
  const expensesPaid = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + asNum(e.amount), 0)
  const currentValue = assets.filter((a) => a.status !== "SOLD" && a.status !== "DISPOSED").reduce((s, a) => s + asNum(a.currentValue), 0)
  const assetPurchaseCost = assets.filter((a) => a.status !== "PLANNED").reduce((s, a) => s + asNum(a.purchaseAmount), 0)
  const netProfit = Math.round((revenue + currentValue - funded - expensesPaid) * 100) / 100
  const roi = computeRoi(netProfit, funded)
  const investors = new Set(contribs.map((c) => c.userId)).size

  const pendingApprovals = pendingCapTxs.length + expenses.filter((e) => e.status === "PENDING").length

  const overBudgetCount = budgets.filter((b) => b.status === "OVER_BUDGET" || asNum(b.variance) < 0).length
  const financeHealth = {
    totalApproved: expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").reduce((s, e) => s + asNum(e.amount), 0),
    totalPaid: expensesPaid,
    totalPending: expenses.filter((e) => e.status === "PENDING").reduce((s, e) => s + asNum(e.amount), 0),
    totalDrafts: expenses.filter((e) => e.status === "DRAFT").reduce((s, e) => s + asNum(e.amount), 0),
    remainingBudget: budgets.reduce((s, b) => s + asNum(b.remainingBudget), 0),
    overBudgetCount,
  }

  const health = computeProjectHealth({
    status: project.status,
    fundingPercent: progress.percent,
    pendingApprovals,
    netProfit,
    expenses: expensesPaid,
    hasOverBudget: overBudgetCount > 0,
  })

  // Ownership breakdown (contribution-weighted, consistent with distribution math).
  const byUser = new Map<string, { user: { id: string; name: string | null; email: string | null }; amount: number }>()
  for (const c of contribs) {
    const cur = byUser.get(c.userId) || { user: c.user, amount: 0 }
    cur.amount += asNum(c.amount)
    byUser.set(c.userId, cur)
  }
  const ownership = Array.from(byUser.values()).map((o) => ({
    userId: o.user.id,
    name: o.user.name || o.user.id,
    email: o.user.email || "",
    amount: o.amount,
    percent: computeOwnershipPercent(o.amount, funded),
  })).sort((a, b) => b.amount - a.amount)

  const monthly = computeMonthlySeries(
    revenues.filter((r) => r.status === "CONFIRMED").map((r) => ({ date: r.revenueDate || r.createdAt, amount: asNum(r.amount) })),
    expenses.filter((e) => e.status === "PAID").map((e) => ({ date: e.expenseDate || e.createdAt, amount: asNum(e.amount) })),
  )
  const roiTrend = computeRoiTrend(monthly, funded)

  const nextDistributionRow = distributions.find((d) => d.status !== "PAID" && d.status !== "CANCELLED")
  const nextDistribution = nextDistributionRow
    ? { id: nextDistributionRow.id, name: nextDistributionRow.name, amount: asNum(nextDistributionRow.totalProfit), date: new Date(nextDistributionRow.distributionDate || nextDistributionRow.createdAt).toISOString(), status: nextDistributionRow.status }
    : null

  // Member panel.
  const myInvested = contribs.filter((c) => c.userId === viewerUserId).reduce((s, c) => s + asNum(c.amount), 0)
  const myOwnershipPercent = computeOwnershipPercent(myInvested, funded)
  const myValue = Math.round(currentValue * (myOwnershipPercent / 100) * 100) / 100
  const myProfitLoss = Math.round((myInvested > 0 ? (netProfit / funded) * myInvested : 0) * 100) / 100
  const myRoi = myInvested > 0 ? Math.round((myProfitLoss / myInvested) * 100) : 0
  const myDists = distributions.flatMap((d) => d.items.map((i) => ({ ...i, distribution: d })))
  const distributionsReceived = myDists.filter((i) => i.status === "PAID").reduce((s, i) => s + asNum(i.profitShare), 0)
  const pendingDistributions = myDists.filter((i) => i.status === "APPROVED" || i.status === "DRAFT").reduce((s, i) => s + asNum(i.profitShare), 0)

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      type: project.type,
      coverImage: project.coverImage,
      color: project.color,
      createdAt: project.createdAt.toISOString(),
      projectOwnerName: project.createdBy?.name || null,
    },
    summary: {
      funded,
      target: progress.target,
      fundingPercent: progress.percent,
      capitalInvested: funded,
      investors,
      currentValue,
      revenue,
      expenses: expensesPaid,
      netProfit,
      roi,
      assetPurchaseCost,
      pendingApprovals,
      financeHealth,
    },
    health,
    nextDistribution,
    fundingRounds: rounds.map((r) => ({
      id: r.id,
      name: r.name,
      targetAmount: asNum(r.targetAmount),
      currentAmount: asNum(r.currentAmount),
      status: r.status,
      allocationMethod: r.allocationMethod,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    })),
    ownership,
    monthly,
    roiTrend,
    assets: assets.map((a) => ({ id: a.id, name: a.name, type: a.type, status: a.status, purchaseAmount: asNum(a.purchaseAmount), currentValue: asNum(a.currentValue) })),
    revenueRecords: revenues.map((r) => ({ id: r.id, type: r.type, amount: asNum(r.amount), status: r.status, createdAt: r.createdAt.toISOString() })),
    expenseRecords: expensesElements(expenses),
    pendingApprovalItems: [
      ...pendingCapTxs.map((t) => ({ kind: "capital" as const, id: t.id, title: `${t.participant?.user?.name || "Member"} capital (${t.classification})`, amount: asNum(t.amount), createdAt: t.createdAt.toISOString() })),
      ...expenses.filter((e) => e.status === "PENDING").map((e) => ({ kind: "expense" as const, id: e.id, title: e.title, amount: asNum(e.amount), createdAt: e.createdAt.toISOString() })),
    ].slice(0, 10),
    myPortfolio: {
      invested: myInvested,
      ownershipPercent: myOwnershipPercent,
      currentValue: myValue,
      profitLoss: myProfitLoss,
      roi: myRoi,
      distributionsReceived,
      pendingDistributions,
      history: contribs.filter((c) => c.userId === viewerUserId).map((c) => ({ id: c.id, amount: asNum(c.amount), status: c.status, createdAt: c.createdAt.toISOString(), reference: c.proofReference })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      distributions: distributions.filter((d) => d.items.length > 0).map((d) => ({
        id: d.id,
        name: d.name,
        amount: d.items.reduce((sum, i) => sum + asNum(i.profitShare), 0),
        status: d.status,
        date: new Date(d.distributionDate || d.createdAt).toISOString(),
      })),
    },
    activity: activity.map((a) => ({ id: a.id, type: a.type, title: a.title, description: a.description, userId: a.userId, createdAt: a.createdAt.toISOString() })),
  }
}

function expensesElements(expenses: Array<{ id: string; title: string; category: string; amount: unknown; status: string; createdAt: Date }>) {
  return expenses.map((e) => ({ id: e.id, title: e.title, category: e.category, amount: asNum(e.amount), status: e.status, createdAt: e.createdAt.toISOString() }))
}

// ─── Project Updates ─────────────────────────────────────────

export async function publishProjectUpdate(
  projectId: string,
  circleId: string,
  userId: string,
  data: { title: string; message?: string },
) {
  const title = data.title.trim()
  if (!title) throw new Error("Update title is required")
  const activity = await addProjectActivity(projectId, userId, "update_published", title, data.message?.trim() || undefined)
  const { notifyCircleMembers } = await import("@/lib/services/notification.service")
  await notifyCircleMembers(circleId, userId, {
    type: "PROJECT_UPDATE_PUBLISHED",
    title,
    message: data.message?.trim() || `A new update was published on this project`,
    link: `/circles/${circleId}/projects/${projectId}/overview`,
  }).catch(() => {})
  return activity
}