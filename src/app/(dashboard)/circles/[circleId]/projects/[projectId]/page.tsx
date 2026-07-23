"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { FolderKanban, Wallet, FileText, Receipt, Coins, TrendingUp, PieChart, BarChart3, Clock, Waves } from "lucide-react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ProjectHeader } from "@/components/projects/project-header"
import { ProjectTabs } from "@/components/projects/project-tabs"
import { OverviewTab } from "@/components/projects/overview/overview-tab"
import { FundingTab } from "@/components/projects/funding/funding-tab"
import { ContributionsTab } from "@/components/projects/contributions/contributions-tab"
import { ShortfallTab } from "@/components/projects/shortfall/shortfall-tab"
import { useProjectData } from "@/components/projects/use-project-data"

export default function ProjectDetailPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const [tab, setTab] = useState("overview")
  const { project, circle, loading, error } = useProjectData(circleId, projectId)
  const router = useRouter()

  // Listen for project header actions
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const action = e.detail
      switch (action) {
        case "record-expense":
          setTab("expenses")
          break
        case "record-revenue":
          setTab("revenue")
          break
        case "configure-waterfall":
          setTab("distributions")
          break
        default:
          toast.info(`Action: ${action}`)
      }
    }
    window.addEventListener("project:action", handler as EventListener)
    return () => window.removeEventListener("project:action", handler as EventListener)
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    )
  }

  if (error || !project || !project.id || !circle) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{error || "Project not found"}</p>
      </div>
    )
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <FolderKanban className="size-3.5" /> },
    { id: "funding", label: "Funding", icon: <Wallet className="size-3.5" /> },
    { id: "contributions", label: "Capital", icon: <Coins className="size-3.5" /> },
    { id: "shortfall", label: "Shortfall", icon: <BarChart3 className="size-3.5" /> },
    { id: "expenses", label: "Expenses", icon: <Receipt className="size-3.5" /> },
    { id: "assets", label: "Assets", icon: <PieChart className="size-3.5" /> },
    { id: "revenue", label: "Revenue", icon: <TrendingUp className="size-3.5" /> },
    { id: "roi", label: "ROI", icon: <TrendingUp className="size-3.5" /> },
    { id: "ownership", label: "Ownership", icon: <PieChart className="size-3.5" /> },
    { id: "distributions", label: "Distributions", icon: <Waves className="size-3.5" /> },
    { id: "timeline", label: "Timeline", icon: <Clock className="size-3.5" /> },
  ]

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <ProjectHeader project={project} circle={circle} circleId={circleId} projectId={projectId} />
      <ProjectTabs tabs={tabs} activeTab={tab} onTabChange={setTab} />

      <div className="min-w-0">
        {tab === "overview" && <OverviewTab project={project} circle={circle} circleId={circleId} projectId={projectId} />}
        {tab === "funding" && <FundingTab circle={circle} circleId={circleId} projectId={projectId} />}
        {tab === "contributions" && <ContributionsTab circle={circle} circleId={circleId} projectId={projectId} />}
        {tab === "shortfall" && <ShortfallTab circle={circle} circleId={circleId} projectId={projectId} />}
        {tab === "expenses" && <ExpensesPlaceholder />}
        {tab === "assets" && <AssetsPlaceholder />}
        {tab === "revenue" && <RevenuePlaceholder />}
        {tab === "roi" && <ROIPlaceholder />}
        {tab === "ownership" && <OwnershipPlaceholder />}
        {tab === "distributions" && <DistributionsPlaceholder />}
        {tab === "timeline" && <TimelinePlaceholder />}
      </div>
    </div>
  )
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

function ExpensesPlaceholder() { return <Placeholder title="Expenses tab" description="Coming in E2" /> }
function AssetsPlaceholder() { return <Placeholder title="Assets tab" description="Coming in E2" /> }
function RevenuePlaceholder() { return <Placeholder title="Revenue tab" description="Coming in E2" /> }
function ROIPlaceholder() { return <Placeholder title="ROI tab" description="Coming in E2" /> }
function OwnershipPlaceholder() { return <Placeholder title="Ownership tab" description="Coming in E3" /> }
function DistributionsPlaceholder() { return <Placeholder title="Distributions tab" description="Coming in E3" /> }
function TimelinePlaceholder() { return <Placeholder title="Timeline tab" description="Coming in E4" /> }
