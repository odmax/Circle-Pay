import { PieChart as PieChartIcon, Waves, FileBarChart, FileText, Clock } from "lucide-react"
import { ProjectEmpty } from "@/components/projects/shared-states"

const PLACEHOLDER_CONFIG: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
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

export const OwnershipPage = makePlaceholder("ownership")
export const DistributionsPage = makePlaceholder("distributions")
export const StatementsPage = makePlaceholder("statements")
export const ReportsPage = makePlaceholder("reports")
export const TimelinePage = makePlaceholder("timeline")
