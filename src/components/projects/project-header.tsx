"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MoreHorizontal, Edit, FolderOpen, Receipt, DollarSign, Waves, FileText, XCircle, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { formatCurrency, formatDate, PROJECT_STATUS_COLORS } from "./types"
import type { ProjectData, CircleData } from "./types"

interface ProjectHeaderProps {
  project: ProjectData
  circle: CircleData
  circleId: string
  projectId: string
}

export function ProjectHeader({ project, circle, circleId, projectId }: ProjectHeaderProps) {
  const router = useRouter()
  const basePath = `/circles/${circleId}/projects/${projectId}`
  const symbol = circle?.currency || "ZAR"
  const progress = project.targetAmount && Number(project.targetAmount) > 0
    ? Math.round((Number(project.currentAmount) / Number(project.targetAmount)) * 100)
    : 0
  const funded = Number(project.currentAmount || 0)
  const target = Number(project.targetAmount || 0)
  const gap = Math.max(0, target - funded)

  function navigateAction(tab: string) {
    router.push(`${basePath}/${tab}`)
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[
        { label: circle?.name || circleId, href: `/circles/${circleId}` },
        { label: "Projects", href: `/circles/${circleId}/projects` },
        { label: project.name },
      ]} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button render={<Link href={`/circles/${circleId}/projects`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0 mt-0.5">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{project.name}</h1>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${PROJECT_STATUS_COLORS[project.status] || ""}`}>
                {project.status?.replace(/_/g, " ")}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" className="rounded-xl shrink-0" />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href={`${basePath}/overview?edit=true`} />}>
              <Edit className="size-4 mr-2" /> Edit Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigateAction("funding")}>
              <FolderOpen className="size-4 mr-2" /> Funding Rounds
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateAction("expenses")}>
              <Receipt className="size-4 mr-2" /> Record Expense
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateAction("revenue")}>
              <DollarSign className="size-4 mr-2" /> Record Revenue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateAction("distributions")}>
              <Waves className="size-4 mr-2" /> Distributions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateAction("statements")}>
              <FileText className="size-4 mr-2" /> Financial Statements
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigateAction("overview")}>
              <XCircle className="size-4 mr-2" /> Close Project
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => navigateAction("overview")}>
              <Archive className="size-4 mr-2" /> Archive Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Target" value={target > 0 ? formatCurrency(target, symbol) : "\u2014"} />
        <SummaryCard label="Funded" value={formatCurrency(funded, symbol)} accent />
        <SummaryCard label="Progress" value={`${progress}%`} />
        <SummaryCard label="Shortfall" value={gap > 0 ? formatCurrency(gap, symbol) : "None"} warning={gap > 0} />
      </div>

      {target > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium">{formatCurrency(funded, symbol)}</span>
              <span className="text-muted-foreground">{formatCurrency(target, symbol)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${progress >= 100 ? "bg-emerald-500" : "bg-brand"}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{progress}% funded \u00B7 Created {formatDate(project.createdAt)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent, warning }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-base sm:text-lg font-bold mt-0.5 truncate ${accent ? "text-brand" : warning ? "text-amber-600" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
