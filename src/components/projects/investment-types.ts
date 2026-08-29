// Investment workspace shared types + status color/health maps.
// Re-exports canonical colors from ./types and pure health helpers from metrics.
import { PROJECT_HEALTH_COLOR, PROJECT_HEALTH_LABEL, type ProjectHealth } from "@/lib/services/project-investment-metrics"

export { PROJECT_HEALTH_COLOR, PROJECT_HEALTH_LABEL }
export type { ProjectHealth }

export interface InvestmentProjectSummaryUI {
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
  tags: string[]
  myCapital: number
  myOwnershipPercent: number
  pendingApprovals: number
  openRound: boolean
  nextDistribution: { id: string; name: string; amount: number; date: string; status: string } | null
  lastActivity: { id: string; title: string; createdAt: string } | null
}