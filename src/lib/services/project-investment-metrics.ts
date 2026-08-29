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