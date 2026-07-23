"use client"

import { FolderKanban, Wallet, FileText, Receipt, Coins, TrendingUp, PieChart, BarChart3, Clock, Waves, FileBarChart } from "lucide-react"
import { ProjectHeader } from "./project-header"
import { ProjectTabs } from "./project-tabs"
import { useProjectContext } from "./project-context"
import { ProjectLoading, ProjectError, ProjectNotFound } from "./shared-states"

const PROJECT_TABS = [
  { id: "overview", label: "Overview", icon: <FolderKanban className="size-3.5" />, href: "overview" },
  { id: "funding", label: "Funding", icon: <Wallet className="size-3.5" />, href: "funding" },
  { id: "contributions", label: "Capital", icon: <Coins className="size-3.5" />, href: "contributions" },
  { id: "shortfall", label: "Shortfall", icon: <BarChart3 className="size-3.5" />, href: "shortfall" },
  { id: "expenses", label: "Expenses", icon: <Receipt className="size-3.5" />, href: "expenses" },
  { id: "assets", label: "Assets", icon: <PieChart className="size-3.5" />, href: "assets" },
  { id: "revenue", label: "Revenue", icon: <TrendingUp className="size-3.5" />, href: "revenue" },
  { id: "roi", label: "ROI", icon: <TrendingUp className="size-3.5" />, href: "roi" },
  { id: "ownership", label: "Ownership", icon: <PieChart className="size-3.5" />, href: "ownership" },
  { id: "distributions", label: "Distributions", icon: <Waves className="size-3.5" />, href: "distributions" },
  { id: "statements", label: "Statements", icon: <FileBarChart className="size-3.5" />, href: "statements" },
  { id: "reports", label: "Reports", icon: <FileText className="size-3.5" />, href: "reports" },
  { id: "timeline", label: "Timeline", icon: <Clock className="size-3.5" />, href: "timeline" },
]

export function ProjectLayout({
  children,
  circleId,
  projectId,
}: {
  children: React.ReactNode
  circleId: string
  projectId: string
}) {
  const { project, circle, loading, error, refresh } = useProjectContext()

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="size-6 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project || !project.id || !circle) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
        <ProjectError message={error || undefined} onRetry={refresh} />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <ProjectHeader project={project} circle={circle} circleId={circleId} projectId={projectId} />
      <ProjectTabs tabs={PROJECT_TABS} circleId={circleId} projectId={projectId} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
