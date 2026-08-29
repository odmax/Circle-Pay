"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, FolderKanban, Users, TrendingUp, Rocket, Eye, ArrowUpRight, ShieldAlert, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "../types"
import { PROJECT_HEALTH_COLOR, PROJECT_HEALTH_LABEL, type ProjectHealth } from "../investment-types"
import { ProgressBar } from "../charts"
import { InvestDialog } from "../invest-dialog"

type ProjectItem = {
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

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "funding", label: "Funding" },
  { id: "operating", label: "Operating" },
  { id: "profitable", label: "Profitable" },
  { id: "completed", label: "Completed" },
  { id: "mine", label: "My Investments" },
]

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  FUNDING_SETUP: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
  FUNDING_OPEN: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PARTIALLY_FUNDED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400",
  FULLY_FUNDED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  ACTIVE: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400",
  REVENUE_GENERATING: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  FAILED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
}

function isTerminalStatus(status: string) {
  return ["COMPLETED", "CLOSED", "CANCELLED", "FAILED", "ARCHIVED"].includes(status)
}

export function ProjectListClient({
  projects,
  circleId,
  currency,
  canCreate,
}: {
  projects: ProjectItem[]
  circleId: string
  currency: string
  canCreate: boolean
}) {
  const [filter, setFilter] = useState("all")
  const [investing, setInvesting] = useState<ProjectItem | null>(null)
  const symbol = currency || "ZAR"

  const filtered = useMemo(() => {
    if (filter === "all") return projects
    if (filter === "mine") return projects.filter((p) => p.myCapital > 0 || p.myOwnershipPercent > 0)
    return projects.filter((p) => p.tags.includes(filter))
  }, [projects, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length }
    for (const p of projects) {
      for (const t of p.tags) c[t] = (c[t] || 0) + 1
      if (p.myCapital > 0 || p.myOwnershipPercent > 0) c.mine = (c.mine || 0) + 1
    }
    return c
  }, [projects])

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filter === f.id
                ? "bg-brand text-white border-brand"
                : "bg-background border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] ${filter === f.id ? "text-white/80" : "text-muted-foreground/70"}`}>{counts[f.id] || 0}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">{projects.length === 0 ? "No projects yet" : `No projects in “${FILTERS.find((f) => f.id === filter)?.label}”`}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {projects.length === 0
                ? "Projects help your circle organise investments, fundraising, purchases and other initiatives."
                : "Try another filter, or head back to All projects."}
            </p>
            {canCreate && projects.length === 0 && (
              <Button render={<Link href={`/circles/${circleId}/projects/new`} />} className="mt-4 rounded-xl bg-brand hover:bg-brand-600">
                <Plus className="size-4 mr-1" /> Create First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} p={p} circleId={circleId} symbol={symbol} onInvest={() => setInvesting(p)} />
          ))}
        </div>
      )}

      <InvestDialog
        open={!!investing}
        onOpenChange={(o) => { if (!o) setInvesting(null) }}
        circleId={circleId}
        projectId={investing?.id || ""}
        currency={symbol}
      />
    </div>
  )
}

function ProjectCard({ p, circleId, symbol, onInvest }: { p: ProjectItem; circleId: string; symbol: string; onInvest: () => void }) {
  const base = `/circles/${circleId}/projects/${p.id}`
  const canInvest = !isTerminalStatus(p.status) && (p.openRound || p.fundingPercent < 100)
  const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <Card className="rounded-2xl overflow-hidden group hover:shadow-md transition-shadow flex flex-col">
      {/* Cover */}
      <div className="relative h-28 w-full flex items-center justify-center" style={{ background: p.color ? `${p.color}22` : "oklch(0.627 0.194 149.214 / 0.08)" }}>
        {p.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverImage} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex items-center justify-center size-14 rounded-2xl bg-background/80 shadow-sm" style={{ color: p.color || "#16a34a" }}>
            <span className="text-lg font-bold">{initials}</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge variant="outline" className={`text-[10px] backdrop-blur ${STATUS_COLORS[p.status] || ""}`}>{p.status.replace(/_/g, " ")}</Badge>
          <Badge variant="outline" className={`text-[10px] backdrop-blur ${PROJECT_HEALTH_COLOR[p.health] || ""}`}>
            <ShieldAlert className="size-3 mr-0.5" /> {PROJECT_HEALTH_LABEL[p.health]}
          </Badge>
        </div>
        {p.openRound && (
          <Badge className="absolute top-2 right-2 text-[10px] bg-brand text-white border-0">
            <Sparkles className="size-3 mr-0.5" /> Funding open
          </Badge>
        )}
      </div>

      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold truncate group-hover:text-brand transition-colors">{p.name}</h3>
            <span className="text-[10px] text-muted-foreground capitalize shrink-0 px-2 py-0.5 rounded-full bg-muted">{p.type.replace(/_/g, " ")}</span>
          </div>
          {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
        </div>

        {/* Funding */}
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="font-semibold">{p.fundingPercent}% funded</span>
            <span className="text-muted-foreground">{formatCurrency(p.funded, symbol)} / {p.target > 0 ? formatCurrency(p.target, symbol) : "no target"}</span>
          </div>
          <ProgressBar percent={p.fundingPercent} />
          {p.target > 0 && p.gap > 0 && <p className="text-[10px] text-muted-foreground mt-1">{formatCurrency(p.gap, symbol)} to target</p>}
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniValue icon={<Users className="size-3" />} label="Investors" value={String(p.investors)} />
          <MiniValue icon={<TrendingUp className="size-3" />} label="ROI" value={`${p.roi}%`} tone={p.roi >= 0 ? "text-emerald-600" : "text-red-500"} />
          <MiniValue icon={<Rocket className="size-3" />} label="Pending" value={String(p.pendingApprovals)} tone={p.pendingApprovals > 0 ? "text-amber-600" : ""} />
        </div>

        {p.myOwnershipPercent > 0 && (
          <p className="text-[10px] text-brand-700 font-medium bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1">
            You own {p.myOwnershipPercent}% · {formatCurrency(p.myCapital, symbol)} invested
          </p>
        )}

        {p.nextDistribution && (
          <p className="text-[10px] text-muted-foreground">
            Next distribution · {formatCurrency(p.nextDistribution.amount, symbol)} ({formatDate(p.nextDistribution.date)})
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center gap-2">
          <Button render={<Link href={`${base}/overview`} />} variant="outline" size="sm" className="flex-1 rounded-xl">
            <Eye className="size-3.5 mr-1" /> Quick View
          </Button>
          {canInvest && (
            <Button size="sm" className="flex-1 rounded-xl bg-brand hover:bg-brand-600" onClick={onInvest}>
              <ArrowUpRight className="size-3.5 mr-1" /> Invest
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MiniValue({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-1.5">
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-sm font-bold ${tone || ""}`}>{value}</p>
    </div>
  )
}