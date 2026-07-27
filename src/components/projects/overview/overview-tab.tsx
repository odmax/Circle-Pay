"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Users, Clock, DollarSign, CheckCircle2, AlertTriangle, FolderOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate, PROJECT_STATUS_COLORS } from "../types"
import type { ProjectData, CircleData, FundingRoundData, ActivityData } from "../types"

interface OverviewTabProps {
  project: ProjectData
  circle: CircleData
  circleId: string
  projectId: string
}

interface OverviewSummary {
  funding: { summary: Record<string, number>; rounds: FundingRoundData[] } | null
  roiSummary: Record<string, number> | null
  distributions: Array<{ id: string; totalProfit: number | string }>
  ownership: { total: number; owners: Array<{ id: string; name: string; email: string; ownership: number }> }
}

export function OverviewTab({ project, circle, circleId, projectId }: OverviewTabProps) {
  const [overviewData, setOverviewData] = useState<OverviewSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(
          `/api/circles/${circleId}/projects/${projectId}/overview-summary`,
        )
        if (!cancelled && r.ok) {
          const data = await r.json()
          setOverviewData(data)
        }
      } catch {
        // stay with null overview data
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId])

  const symbol = circle?.currency || "ZAR"
  const funded = Number(project.currentAmount || 0)
  const target = Number(project.targetAmount || 0)
  const progress = target > 0 ? Math.round((funded / target) * 100) : 0

  if (loading) return <OverviewSkeleton />

  const funding = overviewData?.funding
  const roiSummary = overviewData?.roiSummary
  const ownership = overviewData?.ownership || { total: 0, owners: [] }
  const distributions = overviewData?.distributions || []
  const recentActivity = project.activities?.slice(0, 8) || []

  const totalExpenses = Number(roiSummary?.totalExpensesPaid || 0)
  const totalRevenue = Number(roiSummary?.totalRevenueNet || 0)
  const netProfit = Number(roiSummary?.netProfit || 0)
  const totalShortfall = Number(funding?.summary?.totalShortfall || 0)
  const participantCount = Number(funding?.summary?.participantCount || 0)
  const pendingApprovals = Number(funding?.summary?.pendingCount || 0)
  const activeRounds = funding?.rounds || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard icon={<TrendingUp className="size-4" />} label="Total Revenue" value={formatCurrency(totalRevenue, symbol)} color="text-emerald-600" />
        <MetricCard icon={<TrendingDown className="size-4" />} label="Total Expenses" value={formatCurrency(totalExpenses, symbol)} color="text-red-500" />
        <MetricCard
          icon={netProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          label="Net Profit"
          value={formatCurrency(netProfit, symbol)}
          color={netProfit >= 0 ? "text-emerald-600" : "text-red-500"}
        />
        <MetricCard icon={<Users className="size-4" />} label="Participants" value={String(participantCount)} />
        <MetricCard icon={<CheckCircle2 className="size-4" />} label="ROI" value={`${Number(roiSummary?.roi || 0)}%`} color={Number(roiSummary?.roi || 0) >= 0 ? "text-emerald-600" : "text-red-500"} />
        {totalShortfall > 0 && (
          <MetricCard icon={<AlertTriangle className="size-4" />} label="Shortfall" value={formatCurrency(totalShortfall, symbol)} color="text-amber-600" />
        )}
        {pendingApprovals > 0 && (
          <MetricCard icon={<Clock className="size-4" />} label="Pending" value={String(pendingApprovals)} color="text-amber-600" />
        )}
        <MetricCard icon={<DollarSign className="size-4" />} label="Distributed" value={formatCurrency(distributions.reduce((s: number, d: any) => s + Number(d.totalProfit || 0), 0), symbol)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="size-4" /> Active Funding
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeRounds.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No active funding rounds</p>
            ) : (
              <div className="space-y-2">
                {activeRounds.map((round: FundingRoundData) => {
                  const roundProgress = Number(round.targetAmount) > 0
                    ? Math.round((Number(round.currentAmount) / Number(round.targetAmount)) * 100)
                    : 0
                  return (
                    <div key={round.id} className="p-3 rounded-xl border">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium">{round.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${PROJECT_STATUS_COLORS[round.status] || ""}`}>{round.status}</Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{formatCurrency(Number(round.currentAmount), symbol)}</span>
                        <span>{formatCurrency(Number(round.targetAmount), symbol)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(roundProgress, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{round.allocationMethod} · {roundProgress}%</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ownership</CardTitle>
          </CardHeader>
          <CardContent>
            {ownership.owners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No ownership data</p>
            ) : (
              <div className="space-y-2">
                {ownership.owners.map((owner: any) => (
                  <div key={owner.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-bold text-brand shrink-0">
                        {(owner.name || owner.email || "?")[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm truncate">{owner.name || owner.email}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden hidden sm:block">
                        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(owner.ownership, 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold w-12 text-right">{owner.ownership}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-4" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a: ActivityData) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="size-2 rounded-full bg-muted-foreground/30 mt-1.5 shrink-0" />
                    <div className="w-px flex-1 bg-border" />
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <p className="font-medium truncate">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
        <p className={`text-base sm:text-lg font-bold ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-28" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</CardContent></Card>
      </div>
    </div>
  )
}
