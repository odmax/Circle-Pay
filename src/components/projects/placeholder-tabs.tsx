import { Receipt, PieChart, TrendingUp, BarChart3, PieChart as PieChartIcon, Waves, FileBarChart, FileText, Clock } from "lucide-react"
import { ProjectEmpty } from "@/components/projects/shared-states"

const PLACEHOLDER_CONFIG: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  expenses: { title: "Expenses", description: "Coming in E2", icon: Receipt },
  assets: { title: "Assets", description: "Coming in E2", icon: PieChart },
  revenue: { title: "Revenue", description: "Coming in E2", icon: TrendingUp },
  roi: { title: "ROI", description: "Coming in E2", icon: BarChart3 },
  ownership: { title: "Ownership", description: "Coming in E3", icon: PieChartIcon },
  distributions: { title: "Distributions", description: "Coming in E3", icon: Waves },
  statements: { title: "Financial Statements", description: "Coming in E3", icon: FileBarChart },
  reports: { title: "Reports", description: "Coming in E4", icon: FileText },
  timeline: { title: "Timeline", description: "Coming in E4", icon: Clock },
}

function makePlaceholder(tab: string) {
  const config = PLACEHOLDER_CONFIG[tab]
  return function PlaceholderPage() {
    return <ProjectEmpty icon={config.icon} title={config.title} description={config.description} />
  }
}

export const ExpensesPage = makePlaceholder("expenses")
export const AssetsPage = makePlaceholder("assets")
export const RevenuePage = makePlaceholder("revenue")
export const ROIPage = makePlaceholder("roi")
export const OwnershipPage = makePlaceholder("ownership")
export const DistributionsPage = makePlaceholder("distributions")
export const StatementsPage = makePlaceholder("statements")
export const ReportsPage = makePlaceholder("reports")
export const TimelinePage = makePlaceholder("timeline")
