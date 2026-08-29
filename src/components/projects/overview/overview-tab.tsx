"use client"

import { useEffect, useState } from "react"
import {
  Wallet, Coins, Receipt, TrendingUp, PieChart, Percent,
  Users, Clock, AlertTriangle, Sparkles, Upload, CheckCircle2, Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "../types"
import type { ProjectData, CircleData } from "../types"
import { PROJECT_HEALTH_LABEL } from "../investment-types"
import { ProgressBar, DonutChart, GroupedBarChart, AreaLineChart } from "../charts"
import { InvestDialog } from "../invest-dialog"

interface OverviewTabProps {
  project: ProjectData
  circle: CircleData
  circleId: string
  projectId: string
}

interface DashboardPayload {
  project: { id: string; name: string; description: string | null; status: string; type: string; coverImage: string | null; color: string | null; createdAt: string; projectOwnerName: string | null }
  summary: {
    funded: number; target: number; fundingPercent: number; capitalInvested: number; investors: number;
    currentValue: number; revenue: number; expenses: number; netProfit: number; roi: number;
    assetPurchaseCost: number; pendingApprovals: number;
    financeHealth: { totalApproved: number; totalPaid: number; totalPending: number; totalDrafts: number; remainingBudget: number; overBudgetCount: number }
  }
  health: "healthy" | "watch" | "risk"
  nextDistribution: { id: string; name: string; amount: number; date: string; status: string } | null
  fundingRounds: Array<{ id: string; name: string; targetAmount: number; currentAmount: number; status: string; allocationMethod: string; dueDate: string | null }>
  ownership: Array<{ userId: string; name: string; email: string; amount: number; percent: number }>
  monthly: Array<{ key: string; label: string; revenue: number; expense: number; net: number }>
  roiTrend: Array<{ key: string; label: string; roi: number; net: number }>
  assets: Array<{ id: string; name: string; type: string; status: string; purchaseAmount: number | null; currentValue: number | null }>
  revenueRecords: Array<{ id: string; type: string; amount: number; status: string; createdAt: string }>
  expenseRecords: Array<{ id: string; title: string; category: string; amount: number; status: string; createdAt: string }>
  pendingApprovalItems: Array<{ kind: "capital" | "expense"; id: string; title: string; amount: number; createdAt: string }>
  myPortfolio: {
    invested: number; ownershipPercent: number; currentValue: number; profitLoss: number; roi: number;
    distributionsReceived: number; pendingDistributions: number;
    history: Array<{ id: string; amount: number; status: string; createdAt: string; reference: string | null }>
    distributions: Array<{ id: string; name: string; amount: number; status: string; date: string }>
  }
  activity: Array<{ id: string; type: string; title: string; description: string | null; userId: string | null; createdAt: string }>
  meta?: { userId: string; canManage: boolean; canRecordFunding: boolean; canApprove: boolean }
}

const CHART_PALETTE = [
  "#16a34a", "#7c3aed", "#2563eb", "#f59e0b", "#ef4444", "#0891b2", "#db2777", "#65a30d",
]

export function OverviewTab({ project, circle, circleId, projectId }: OverviewTabProps) {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvest, setShowInvest] = useState(false)
  const [updateTitle, setUpdateTitle] = useState("")
  const [updateMessage, setUpdateMessage] = useState("")
  const [publishing, setPublishing] = useState(false)

  const symbol = circle?.currency || "ZAR"

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investment-dashboard`)
        if (!r.ok) throw new Error("Failed to load project data")
        const json = await r.json()
        if (!cancelled) { setData(json); setError(null) }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId, reloadKey])

  const refresh = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1) }

  if (loading) return <OverviewSkeleton />

  if (error || !data) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <AlertTriangle className="size-10 text-amber-500 mb-3" />
          <p className="font-medium">Could not load project data</p>
          <p className="text-sm text-muted-foreground mt-1">{error || "Something went wrong"}</p>
          <Button variant="outline" className="rounded-xl mt-4" onClick={refresh}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  const { summary, health, nextDistribution, fundingRounds, ownership, monthly, roiTrend, assets, myPortfolio, pendingApprovalItems, activity, meta } = data
  const names = ["Funding", "Capital", "Expenses", "Revenue", "Profit", "Assets", "ROI", "Investors", "Pending"]
  const values = [
    summary.fundingPercent > 0 ? `${summary.fundingPercent}%` : formatCurrency(summary.funded, symbol),
    formatCurrency(summary.capitalInvested, symbol),
    formatCurrency(summary.expenses, symbol),
    formatCurrency(summary.revenue, symbol),
    formatCurrency(summary.netProfit, symbol),
    formatCurrency(summary.currentValue, symbol),
    `${summary.roi}%`,
    String(summary.investors),
    String(summary.pendingApprovals),
  ]
  const colors = ["text-brand", "text-brand", "text-red-500", "text-emerald-600", summary.netProfit >= 0 ? "text-emerald-600" : "text-red-500", "text-blue-600", summary.roi >= 0 ? "text-emerald-600" : "text-red-500", "", summary.pendingApprovals > 0 ? "text-amber-600" : ""]

  const ownershipSegments = ownership.slice(0, 6).map((o, i) => ({ label: o.name, value: o.amount, color: CHART_PALETTE[i % CHART_PALETTE.length] }))
  const terminal = ["COMPLETED", "CLOSED", "CANCELLED", "FAILED", "ARCHIVED"].includes(project.status)
  const openRound = fundingRounds.some((r) => r.status === "OPEN")

  const publishUpdate = async () => {
    if (!updateTitle.trim()) { toast.error("Update title is required"); return }
    setPublishing(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: updateTitle.trim(), message: updateMessage.trim() || undefined }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to publish update")
      toast.success("Update published")
      setUpdateTitle(""); setUpdateMessage("")
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      {health !== "healthy" && (
        <Card className={`rounded-2xl ${health === "risk" ? "border-red-200" : "border-amber-200"}`}>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <AlertTriangle className={`size-5 shrink-0 ${health === "risk" ? "text-red-500" : "text-amber-600"}`} />
            <div className="text-sm">
              <span className="font-semibold">Health: {PROJECT_HEALTH_LABEL[health]}</span>
              <span className="text-muted-foreground ml-2">
                {health === "risk"
                  ? summary.netProfit < 0 ? "Project is running at a loss." : summary.pendingApprovals > 0 ? `${summary.pendingApprovals} approvals are waiting.` : "Project flagged at risk."
                  : `${summary.pendingApprovals} approvals waiting or revenue has not started.`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {names.map((name, i) => (
          <MetricCard key={name} icon={<IconFor name={name} />} label={name} value={values[i]} color={colors[i]} />
        ))}
      </div>

      {/* Member investment panel + invest CTA */}
      <Card className="rounded-2xl border-brand/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-brand" />
              <h3 className="font-semibold">Your Investment</h3>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/circles/${circleId}/projects/${projectId}/member-statement`}
                className="inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <Download className="size-4 mr-1" /> Statement
              </a>
              {!terminal && (
                <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowInvest(true)} disabled={summary.funded >= summary.target && !openRound}>
                  <Upload className="size-4 mr-1" /> Invest / Commit
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 mt-4 gap-3">
            <MiniStat label="Invested" value={formatCurrency(myPortfolio.invested, symbol)} />
            <MiniStat label="Ownership" value={`${myPortfolio.ownershipPercent}%`} />
            <MiniStat label="Current Value" value={formatCurrency(myPortfolio.currentValue, symbol)} />
            <MiniStat label="Profit / Loss" value={formatCurrency(myPortfolio.profitLoss, symbol)} valueClass={myPortfolio.profitLoss >= 0 ? "text-emerald-600" : "text-red-500"} />
            <MiniStat label="Your ROI" value={`${myPortfolio.roi}%`} valueClass={myPortfolio.roi >= 0 ? "text-emerald-600" : "text-red-500"} />
            <MiniStat label="Distributions Received" value={formatCurrency(myPortfolio.distributionsReceived, symbol)} />
            <MiniStat label="Pending Distributions" value={formatCurrency(myPortfolio.pendingDistributions, symbol)} valueClass={myPortfolio.pendingDistributions > 0 ? "text-amber-600" : ""} />
            <MiniStat label="History" value={`${myPortfolio.history.length} entries`} />
          </div>
          {myPortfolio.history.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {myPortfolio.history.slice(0, 4).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
                    <span className="text-xs text-muted-foreground truncate">{h.reference || "Capital"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium">{formatCurrency(h.amount, symbol)}</span>
                    <Badge variant="outline" className={`text-[10px] ${h.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : h.status === "PROOF_SUBMITTED" ? "border-amber-200 bg-amber-50 text-amber-700" : h.status === "REJECTED" ? "border-red-200 bg-red-50 text-red-700" : ""}`}>{h.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funding + ownership */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Funding Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-lg">{summary.fundingPercent}%</span>
              <span className="text-muted-foreground">{summary.fundingPercent >= 100 ? "Fully funded" : `${formatCurrency(summary.target - summary.funded, symbol)} to go`}</span>
            </div>
            <ProgressBar percent={summary.fundingPercent} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(summary.funded, symbol)} raised</span>
              <span>of {formatCurrency(summary.target, symbol)} target</span>
            </div>
            {openRound && (
              <p className="text-xs text-brand-600 font-medium flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> A funding round is currently open
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><PieChart className="size-4" /> Ownership Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {ownershipSegments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No investors yet</p>
            ) : (
              <DonutChart segments={ownershipSegments} centerValue={`${summary.investors}`} centerLabel="investors" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="size-4" /> Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <GroupedBarChart data={monthly.map((m) => ({ label: m.label, a: m.revenue, b: m.expense }))} aLabel="Revenue" bLabel="Expenses" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Coins className="size-4" /> Cash Flow</CardTitle></CardHeader>
          <CardContent>
            <AreaLineChart data={monthly.map((m) => ({ label: m.label, value: m.net }))} color="#0891b2" signLabels />
          </CardContent>
        </Card>
        <Card className="rounded-2xl md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Percent className="size-4" /> ROI Trend</CardTitle></CardHeader>
          <CardContent>
            <AreaLineChart data={roiTrend.map((r) => ({ label: r.label, value: r.roi }))} color="#7c3aed" signLabels />
          </CardContent>
        </Card>
      </div>

      {/* Pending approvals + next distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="size-4" /> Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingApprovalItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">All caught up</p>
            ) : (
              <div className="space-y-2">
                {pendingApprovalItems.slice(0, 6).map((a) => (
                  <div key={`${a.kind}-${a.id}`} className="flex items-center justify-between text-sm p-2 rounded-xl border">
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      <Badge variant="outline" className="text-[9px] shrink-0 capitalize">{a.kind}</Badge>
                      <span className="truncate">{a.title}</span>
                    </span>
                    <span className="font-medium shrink-0">{formatCurrency(a.amount, symbol)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="size-4" /> Distributions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextDistribution ? (
              <div className="p-3 rounded-xl border bg-brand/5">
                <p className="text-sm font-medium">{nextDistribution.name}</p>
                <p className="text-lg font-bold text-brand mt-1">{formatCurrency(nextDistribution.amount, symbol)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(nextDistribution.date)} · {nextDistribution.status.replace(/_/g, " ")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-3 text-center">No upcoming distribution</p>
            )}
            {assets.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Assets ({assets.length})</p>
                <div className="space-y-1.5">
                  {assets.slice(0, 4).map((a) => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="truncate">{a.name}</span>
                      <span className="font-medium shrink-0">{formatCurrency(Number(a.currentValue || 0), symbol)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity & updates */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="size-4" /> Activity & Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {meta?.canManage && (
            <div className="mb-4 p-3 rounded-xl border bg-muted/30 space-y-2">
              <input
                value={updateTitle}
                onChange={(e) => setUpdateTitle(e.target.value)}
                placeholder="Update title — e.g. 'Funding round open'"
                className="w-full rounded-xl border bg-background text-sm px-3 py-2 outline-none focus:ring-2 ring-brand/30"
              />
              <Textarea value={updateMessage} onChange={(e) => setUpdateMessage(e.target.value)} placeholder="Message (optional)" className="rounded-xl" rows={2} />
              <Button size="sm" className="rounded-xl bg-brand hover:bg-brand-600" onClick={publishUpdate} disabled={publishing || !updateTitle.trim()}>
                {publishing ? "Publishing..." : "Publish update"}
              </Button>
            </div>
          )}
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {activity.slice(0, 8).map((a) => (
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

      <InvestDialog open={showInvest} onOpenChange={setShowInvest} circleId={circleId} projectId={projectId} currency={symbol} onSuccess={refresh} />
    </div>
  )
}

function IconFor({ name }: { name: string }) {
  const map: Record<string, React.ReactNode> = {
    Funding: <Wallet className="size-4" />,
    Capital: <Coins className="size-4" />,
    Expenses: <Receipt className="size-4" />,
    Revenue: <TrendingUp className="size-4" />,
    Profit: <TrendingUp className="size-4" />,
    Assets: <PieChart className="size-4" />,
    ROI: <Percent className="size-4" />,
    Investors: <Users className="size-4" />,
    Pending: <Clock className="size-4" />,
  }
  return map[name] || <Wallet className="size-4" />
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
        <p className={`text-base sm:text-lg font-bold truncate ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${valueClass}`}>{value}</p>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>
        ))}
      </div>
      <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</CardContent></Card>
      </div>
    </div>
  )
}