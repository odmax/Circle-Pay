// Pure, dependency-free investment metric helpers.
// Kept free of Prisma/Next imports so they can be unit-tested directly.

export type ProjectHealth = "healthy" | "watch" | "risk"

export interface FundingProgress {
  funded: number
  target: number
  percent: number
  gap: number
}

export interface HealthInput {
  status: string
  fundingPercent: number
  pendingApprovals: number
  netProfit: number
  expenses: number
  hasOverBudget: boolean
}

export function computeFundingProgress(funded: number, target: number): FundingProgress {
  const safeTarget = Math.max(0, Number(target) || 0)
  const safeFunded = Math.max(0, Number(funded) || 0)
  const percent = safeTarget > 0 ? Math.min(100, Math.round((safeFunded / safeTarget) * 100)) : 0
  return { funded: safeFunded, target: safeTarget, percent, gap: Math.max(0, safeTarget - safeFunded) }
}

export function computeOwnershipPercent(myCapital: number, totalCapital: number): number {
  const total = Number(totalCapital) || 0
  if (total <= 0) return 0
  return Math.round((Number(myCapital) / total) * 10000) / 100
}

export function computeNetProfit(revenue: number, expenses: number): number {
  return Math.round((Number(revenue || 0) - Number(expenses || 0)) * 100) / 100
}

export function computeRoi(netProfit: number, funded: number): number {
  const raised = Number(funded) || 0
  if (raised <= 0) return 0
  return Math.round((netProfit / raised) * 100)
}

export function computeProjectHealth(input: HealthInput): ProjectHealth {
  const status = input.status || ""
  if (["CANCELLED", "FAILED", "SUSPENDED"].includes(status)) return "risk"
  if (input.hasOverBudget) return "risk"
  if (input.netProfit < 0) return "risk"
  if (input.pendingApprovals > 0) return "watch"
  // Funding stage that hasn't raised anything yet needs attention.
  if (["FUNDING_OPEN", "PARTIALLY_FUNDED"].includes(status) && input.fundingPercent === 0) return "watch"
  if (input.expenses > 0 && input.netProfit === 0) return "watch"
  return "healthy"
}

export type ProjectFilterTag = "active" | "funding" | "operating" | "profitable" | "completed"

export function projectFilterTags(input: { status: string; netProfit: number; fundingPercent: number }): ProjectFilterTag[] {
  const status = input.status || ""
  const tags: ProjectFilterTag[] = []
  const terminal = ["COMPLETED", "CLOSED", "CANCELLED", "FAILED", "ARCHIVED"]
  if (!terminal.includes(status)) tags.push("active")
  if (["FUNDING_SETUP", "FUNDING_OPEN", "PARTIALLY_FUNDED", "DRAFT", "FULLY_FUNDED"].includes(status) && input.fundingPercent < 100) {
    tags.push("funding")
  }
  if (["FULLY_FUNDED", "ACTIVE", "REVENUE_GENERATING"].includes(status)) tags.push("operating")
  if (Number(input.netProfit) > 0) tags.push("profitable")
  if (["COMPLETED", "CLOSED"].includes(status)) tags.push("completed")
  return tags
}

export interface MonthlyPoint {
  key: string
  label: string
  revenue: number
  expense: number
  net: number
}

export interface DatedAmount {
  date?: string | Date | null
  amount: number | string | null
}

// Build a last-N-months revenue/expense/cash-flow series from dated records.
export function computeMonthlySeries(
  revenues: DatedAmount[],
  expenses: DatedAmount[],
  months = 6,
): MonthlyPoint[] {
  const now = new Date()
  const buckets: MonthlyPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-ZA", { month: "short" }),
      revenue: 0,
      expense: 0,
      net: 0,
    })
  }
  const bucketFor = (date?: string | Date | null) => {
    if (!date) return null
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return null
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }
  for (const r of revenues) {
    const key = bucketFor(r.date)
    if (key) { const b = buckets.find((x) => x.key === key); if (b) b.revenue += Number(r.amount || 0) }
  }
  for (const e of expenses) {
    const key = bucketFor(e.date)
    if (key) { const b = buckets.find((x) => x.key === key); if (b) b.expense += Number(e.amount || 0) }
  }
  buckets.forEach((b) => { b.net = Math.round((b.revenue - b.expense) * 100) / 100 })
  return buckets
}

// Cumulative ROI trend across a monthly revenue/expense series.
export function computeRoiTrend(points: MonthlyPoint[], funded: number): Array<{ key: string; label: string; roi: number; net: number }> {
  const raised = Number(funded) || 0
  let cumulative = 0
  return points.map((p) => {
    cumulative += p.net
    const roi = raised > 0 ? Math.round((cumulative / raised) * 100) : 0
    return { key: p.key, label: p.label, roi, net: Math.round(cumulative * 100) / 100 }
  })
}

export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  healthy: "Healthy",
  watch: "Watch",
  risk: "At Risk",
}

export const PROJECT_HEALTH_COLOR: Record<ProjectHealth, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-amber-200 bg-amber-50 text-amber-700",
  risk: "border-red-200 bg-red-50 text-red-700",
}

export function slugifyOpportunity(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "opportunity"
}

export interface OpportunityMineInput {
  id: string
  title: string
  status: string
  myCommitted: number
  myConfirmed: number
  myPending: number
  raised: number
  expectedReturn: number | null
  closingDate: string | null
  projectId: string | null
}

export function getMyOpportunities(opportunities: OpportunityMineInput[]) {
  return opportunities
    .filter((o) => o.myCommitted > 0)
    .map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      committed: o.myCommitted,
      confirmed: o.myConfirmed,
      pending: o.myPending,
      ownershipEstimate: o.raised > 0 ? Math.round((o.myConfirmed / o.raised) * 10000) / 100 : 0,
      expectedReturn: o.expectedReturn != null ? Math.round(o.myConfirmed * (o.expectedReturn / 100) * 100) / 100 : null,
      closingDate: o.closingDate,
      projectId: o.projectId,
    }))
}

// ─── Portfolio Alerts (pure, deterministic) ─────────────────

export interface PortfolioAlert {
  id: string
  level: "info" | "warning" | "risk"
  title: string
  description: string
  projectId?: string
  projectName?: string
}

export interface PortfolioAlertProject {
  id: string
  name: string
  status: string
  fundingPercent: number
  funded: number
  target: number
  netProfit: number
  revenue: number
  expenses: number
  pendingApprovals: number
}

export interface ComputePortfolioAlertsOptions {
  projects: PortfolioAlertProject[]
  overBudgetProjectIds?: string[]
  upcomingDistributions?: Array<{ id: string; projectId: string; name: string; amount: number; status: string }>
  monthly?: MonthlyPoint[]
}

export function computePortfolioAlerts(opts: ComputePortfolioAlertsOptions): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = []
  const overBudget = new Set(opts.overBudgetProjectIds || [])
  const monthly = opts.monthly || []

  for (const p of opts.projects) {
    const warn = (level: PortfolioAlert["level"], title: string, description: string) =>
      alerts.push({ id: `p-${p.id}`, level, title, description, projectId: p.id, projectName: p.name })

    if (p.fundingPercent < 100 && (p.status === "FUNDING_OPEN" || p.status === "PARTIALLY_FUNDED" || p.status === "FUNDING_SETUP")) {
      const gap = computeFundingProgress(p.funded, p.target).gap
      warn(
        p.fundingPercent === 0 ? "risk" : "warning",
        `${p.name}: funding shortfall`,
        gap > 0 ? `${gap.toLocaleString()} still needed to reach target.` : "Round is not yet fully subscribed.",
      )
    }
    if (p.netProfit < 0) warn("risk", `${p.name}: operating at a loss`, `Net position is ${p.netProfit.toLocaleString()}.`)
    if (overBudget.has(p.id)) warn("warning", `${p.name}: over budget`, "One or more budget categories exceed approved amounts.")
    if (p.pendingApprovals > 0) warn("warning", `${p.name}: approvals pending`, `${p.pendingApprovals} capital/expense item(s) await review.`)

    const activeStatus = ["ACTIVE", "REVENUE_GENERATING", "FULLY_FUNDED"].includes(p.status)
    if (activeStatus && p.revenue === 0 && p.expenses === 0) warn("info", `${p.name}: missing financial data`, "Active project with no revenue or expenses recorded yet.")
    if (activeStatus && p.revenue === 0 && p.expenses > 0) warn("warning", `${p.name}: no revenue yet`, "Expenses recorded but no revenue has been booked.")
  }

  // Revenue decline (portfolio level, month-over-month).
  const withData = monthly.filter((m) => m.revenue > 0 || m.expense > 0)
  if (withData.length >= 2) {
    const last = withData[withData.length - 1]
    const prev = withData[withData.length - 2]
    if (prev.revenue > 0 && last.revenue < prev.revenue * 0.8) {
      alerts.push({
        id: "revenue-decline",
        level: "warning",
        title: "Portfolio revenue decline",
        description: `${last.label} revenue (${last.revenue.toLocaleString()}) is down vs ${prev.label} (${prev.revenue.toLocaleString()}).`,
      })
    }
  }

  for (const d of (opts.upcomingDistributions || []).slice(0, 3)) {
    alerts.push({
      id: `dist-${d.id}`,
      level: "info",
      title: `Distribution due`,
      description: `"${d.name}" · ${d.amount.toLocaleString()} (${d.status.replace(/_/g, " ")}).`,
      projectId: d.projectId,
      projectName: d.projectId,
    })
  }

  return alerts
}