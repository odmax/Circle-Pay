"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Wallet, TrendingUp, TrendingDown, Receipt, Coins, Percent, FolderKanban,
  Users, Clock, Banknote, ShieldAlert, AlertTriangle, Info, ArrowUpRight,
  Eye, Sparkles, PiggyBank, Activity as ActivityIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/components/projects/types"
import { PROJECT_HEALTH_COLOR, PROJECT_HEALTH_LABEL, type ProjectHealth } from "@/components/projects/investment-types"
import { ProgressBar, DonutChart, GroupedBarChart, AreaLineChart } from "@/components/projects/charts"
import { InvestDialog } from "@/components/projects/invest-dialog"

export interface PortfolioAlert {
  id: string
  level: "info" | "warning" | "risk"
  title: string
  description: string
  projectId?: string
  projectName?: string
}

export interface PortfolioProjectRow {
  id: string
  name: string
  status: string
  health: ProjectHealth
  fundingPercent: number
  capital: number
  currentValue: number
  profit: number
  roi: number
  investors: number
  myOwnershipPercent: number
  myCapital: number
  nextDistribution: { id: string; name: string; amount: number; date: string; status: string } | null
  openRound: boolean
  pendingApprovals: number
}

export interface PortfolioData {
  currency: string
  summary: {
    totalCapitalInvested: number
    portfolioValue: number
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    overallRoi: number
    activeProjects: number
    totalInvestors: number
    pendingApprovals: number
    upcomingDistributions: number
  }
  projects: PortfolioProjectRow[]
  performance: {
    valueTrend: Array<{ key: string; label: string; revenue: number; expense: number; net: number }>
    roiTrend: Array<{ key: string; label: string; roi: number; net: number }>
    capitalAllocation: Array<{ projectId: string; name: string; capital: number; color: string }>
    comparison: Array<{ id: string; name: string; roi: number; profit: number; fundingPercent: number; health: ProjectHealth }>
    best: PortfolioProjectRow | null
    worst: PortfolioProjectRow | null
  }
  myPosition: {
    invested: number
    currentValue: number
    profitLoss: number
    roi: number
    distributionsReceived: number
    pendingDistributions: number
    activeInvestments: number
    ownership: Array<{ projectId: string; name: string; percent: number; invested: number }>
  }
  upcomingDistributions: Array<{ id: string; projectId: string; projectName: string; name: string; amount: number; date: string; status: string }>
  alerts: PortfolioAlert[]
  activity: Array<{ id: string; projectId: string | null; projectName: string | null; type: string; title: string; description: string | null; actorName: string | null; createdAt: string }>
}

export function PortfolioErrorState({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Investment Portfolio</h1>
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <ShieldAlert className="size-10 text-red-500 mb-3" />
          <p className="font-medium">Could not load your portfolio</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}

const TERMINAL = ["COMPLETED", "CLOSED", "CANCELLED", "FAILED", "ARCHIVED"]

export function PortfolioDashboard({ circleId, circleName, currency, data }: {
  circleId: string
  circleName: string
  currency: string
  data: PortfolioData
}) {
  const router = useRouter()
  const [investingId, setInvestingId] = useState<string | null>(null)
  const symbol = currency || "ZAR"
  const { summary, projects, myPosition, alerts, activity } = data

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Investment Portfolio</h1>
        <p className="text-muted-foreground">{circleName} — a live command centre for every investment project</p>
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Create an investment project to start tracking capital, returns and performance here.</p>
            <Button render={<Link href={`/circles/${circleId}/projects`} />} className="mt-4 rounded-xl bg-brand hover:bg-brand-600">
              <FolderKanban className="size-4 mr-1" /> Open Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Investment Portfolio</h1>
        <p className="text-muted-foreground">{circleName} — aggregated live performance of every investment project</p>
      </div>

      {/* Portfolio metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard icon={<Wallet className="size-4" />} label="Capital Invested" value={formatCurrency(summary.totalCapitalInvested, symbol)} />
        <MetricCard icon={<Banknote className="size-4" />} label="Portfolio Value" value={formatCurrency(summary.portfolioValue, symbol)} />
        <MetricCard icon={<TrendingUp className="size-4" />} label="Total Revenue" value={formatCurrency(summary.totalRevenue, symbol)} color="text-emerald-600" />
        <MetricCard icon={<TrendingDown className="size-4" />} label="Total Expenses" value={formatCurrency(summary.totalExpenses, symbol)} color="text-red-500" />
        <MetricCard icon={<Percent className="size-4" />} label="Net Profit" value={formatCurrency(summary.netProfit, symbol)} color={summary.netProfit >= 0 ? "text-emerald-600" : "text-red-500"} />
        <MetricCard icon={<TrendingUp className="size-4" />} label="Overall ROI" value={`${summary.overallRoi}%`} color={summary.overallRoi >= 0 ? "text-emerald-600" : "text-red-500"} />
        <MetricCard icon={<FolderKanban className="size-4" />} label="Active Projects" value={String(summary.activeProjects)} />
        <MetricCard icon={<Users className="size-4" />} label="Total Investors" value={String(summary.totalInvestors)} />
        <MetricCard icon={<Clock className="size-4" />} label="Pending Approvals" value={String(summary.pendingApprovals)} color={summary.pendingApprovals > 0 ? "text-amber-600" : ""} />
        <MetricCard icon={<Banknote className="size-4" />} label="Upcoming Distributions" value={String(summary.upcomingDistributions)} color={summary.upcomingDistributions > 0 ? "text-brand" : ""} />
      </div>

      {/* My investment position */}
      <Card className="rounded-2xl border-brand/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <PiggyBank className="size-4 text-brand" />
              <h3 className="font-semibold">Your Investment Position</h3>
            </div>
            <Button render={<Link href={`/circles/${circleId}/projects`} />} variant="outline" size="sm" className="rounded-xl">
              <ArrowUpRight className="size-3.5 mr-1" /> Browse projects
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 mt-4 gap-3">
            <MiniStat label="Total Invested" value={formatCurrency(myPosition.invested, symbol)} />
            <MiniStat label="Current Value" value={formatCurrency(myPosition.currentValue, symbol)} />
            <MiniStat label="Profit / Loss" value={formatCurrency(myPosition.profitLoss, symbol)} valueClass={myPosition.profitLoss >= 0 ? "text-emerald-600" : "text-red-500"} />
            <MiniStat label="Overall ROI" value={`${myPosition.roi}%`} valueClass={myPosition.roi >= 0 ? "text-emerald-600" : "text-red-500"} />
            <MiniStat label="Ownership Across Projects" value={`${myPosition.ownership.length}`} />
            <MiniStat label="Distributions Received" value={formatCurrency(myPosition.distributionsReceived, symbol)} />
            <MiniStat label="Pending Distributions" value={formatCurrency(myPosition.pendingDistributions, symbol)} valueClass={myPosition.pendingDistributions > 0 ? "text-amber-600" : ""} />
            <MiniStat label="Active Investments" value={String(myPosition.activeInvestments)} />
          </div>
          {myPosition.ownership.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {myPosition.ownership.map((o) => (
                <Link key={o.projectId} href={`/circles/${circleId}/projects/${o.projectId}/overview`} className="flex items-center justify-between text-sm rounded-lg border border-border/40 px-3 py-1.5 hover:bg-muted/40 transition-colors">
                  <span className="min-w-0 truncate">{o.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground text-xs">{formatCurrency(o.invested, symbol)}</span>
                    <span className="font-semibold w-14 text-right">{o.percent}%</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance charts */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="size-4" /> Portfolio Value Trend</CardTitle></CardHeader>
          <CardContent><AreaLineChart data={valueTrendData(data)} color="#16a34a" signLabels /></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4" /> Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent><GroupedBarChart data={data.performance.valueTrend.map((m) => ({ label: m.label, a: m.revenue, b: m.expense }))} aLabel="Revenue" bLabel="Expenses" /></CardContent>
        </Card>
        <Card className="rounded-2xl md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Percent className="size-4" /> Portfolio ROI Trend</CardTitle></CardHeader>
          <CardContent><AreaLineChart data={data.performance.roiTrend.map((r) => ({ label: r.label, value: r.roi }))} color="#7c3aed" signLabels /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Coins className="size-4" /> Capital Allocation by Project</CardTitle></CardHeader>
          <CardContent>
            {data.performance.capitalAllocation.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No capital allocated yet</p>
            ) : (
              <DonutChart segments={data.performance.capitalAllocation.map((a) => ({ label: a.name, value: a.capital, color: a.color }))} centerValue={formatCurrency(summary.totalCapitalInvested, symbol)} centerLabel="capital" />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="size-4" /> Project Performance Comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <GroupedBarChart
              data={data.performance.comparison.slice(0, 8).map((c) => ({ label: shortName(c.name), a: Math.max(0, c.roi), b: c.roi < 0 ? Math.abs(c.roi) : 0 }))}
              aLabel="ROI %" bLabel="Loss %"
            />
            <div className="grid grid-cols-2 gap-2">
              <PerfCard title="Best performing" project={data.performance.best} symbol={symbol} />
              <PerfCard title="Worst performing" project={data.performance.worst} symbol={symbol} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project portfolio */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FolderKanban className="size-4" /> Project Portfolio</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} p={p} circleId={circleId} symbol={symbol} onInvest={() => setInvestingId(p.id)} />
          ))}
        </CardContent>
      </Card>

      {/* Alerts + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="size-4" /> Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Portfolio looks healthy — no alerts.</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 8).map((a) => (
                  <div key={a.id} className={`flex gap-3 text-sm p-3 rounded-xl border ${a.level === "risk" ? "border-red-200 bg-red-50/50" : a.level === "warning" ? "border-amber-200 bg-amber-50/50" : "border-sky-200 bg-sky-50/40"}`}>
                    {a.level === "risk" ? <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" /> : a.level === "warning" ? <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" /> : <Info className="size-4 text-sky-600 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ActivityIcon className="size-4" /> Investment Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {activity.slice(0, 20).map((a) => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <span className="size-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">{activityIcon(a)}</span>
                    </div>
                    <div className="flex-1 min-w-0 pb-2 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.projectName}{a.actorName ? ` · ${a.actorName}` : ""}{a.description ? ` — ${a.description}` : ""}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <InvestDialog
        open={!!investingId}
        onOpenChange={(o) => { if (!o) setInvestingId(null) }}
        circleId={circleId}
        projectId={investingId || ""}
        currency={symbol}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}

function valueTrendData(data: PortfolioData) {
  let cumulative = 0
  return data.performance.valueTrend.map((m) => {
    cumulative += m.net
    return { label: m.label, value: Math.round(cumulative * 100) / 100 }
  })
}

function shortName(name: string) {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name
}

function activityIcon(a: PortfolioData["activity"][number]) {
  const t = a.type || ""
  if (t.startsWith("capital") || t.startsWith("contribution")) return <Coins className="size-3 text-brand" />
  if (t.startsWith("expense")) return <Receipt className="size-3 text-red-500" />
  if (t.startsWith("revenue")) return <TrendingUp className="size-3 text-emerald-600" />
  if (t.startsWith("asset")) return <FolderKanban className="size-3 text-blue-600" />
  if (t.startsWith("ownership")) return <Users className="size-3 text-purple-600" />
  if (t.startsWith("distribution")) return <Banknote className="size-3 text-amber-600" />
  if (t.startsWith("funding")) return <TrendingUp className="size-3 text-brand" />
  if (t.startsWith("update")) return <Sparkles className="size-3 text-sky-600" />
  return <ActivityIcon className="size-3 text-muted-foreground" />
}

function ProjectRow({ p, circleId, symbol, onInvest }: { p: PortfolioProjectRow; circleId: string; symbol: string; onInvest: () => void }) {
  const base = `/circles/${circleId}/projects/${p.id}`
  const canInvest = !TERMINAL.includes(p.status) && (p.openRound || p.fundingPercent < 100)
  const isProfitable = p.profit >= 0

  return (
    <div className="rounded-xl border p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`${base}/overview`} className="font-semibold hover:text-brand transition-colors truncate">{p.name}</Link>
            <Badge variant="outline" className={`text-[10px] ${PROJECT_HEALTH_COLOR[p.health] || ""}`}>
              <ShieldAlert className="size-3 mr-0.5" /> {PROJECT_HEALTH_LABEL[p.health]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            <span>Capital {formatCurrency(p.capital, symbol)}</span>
            <span>Value {formatCurrency(p.currentValue, symbol)}</span>
            <span className={isProfitable ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>Profit {formatCurrency(p.profit, symbol)}</span>
            <span className={isProfitable ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>ROI {p.roi}%</span>
            <span>{p.investors} investors</span>
            {p.pendingApprovals > 0 && <span className="text-amber-600">{p.pendingApprovals} pending</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button render={<Link href={`${base}/overview`} />} variant="outline" size="sm" className="rounded-xl h-8">
            <Eye className="size-3.5 mr-1" /> Quick View
          </Button>
          {canInvest && (
            <Button size="sm" className="rounded-xl h-8 bg-brand hover:bg-brand-600" onClick={onInvest}>
              <ArrowUpRight className="size-3.5 mr-1" /> Invest
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="font-medium">Funding {p.fundingPercent}%</span>
            <span className="text-muted-foreground">{formatCurrency(p.capital, symbol)} raised</span>
          </div>
          <ProgressBar percent={p.fundingPercent} />
        </div>
        {p.nextDistribution ? (
          <p className="text-[10px] text-muted-foreground self-end">
            Next distribution · {formatCurrency(p.nextDistribution.amount, symbol)} ({formatDate(p.nextDistribution.date)})
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground self-end">No upcoming distribution</p>
        )}
      </div>

      {(p.myOwnershipPercent > 0 || p.myCapital > 0) && (
        <p className="text-[10px] text-brand-700 font-medium bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1 mt-3">
          You own {p.myOwnershipPercent}% · {formatCurrency(p.myCapital, symbol)} invested
        </p>
      )}
    </div>
  )
}

function PerfCard({ title, project, symbol }: { title: string; project: PortfolioProjectRow | null; symbol: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      {project ? (
        <>
          <p className="font-semibold truncate mt-0.5">{project.name}</p>
          <p className={`text-lg font-bold mt-0.5 ${project.roi >= 0 ? "text-emerald-600" : "text-red-500"}`}>{project.roi}%</p>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(project.profit, symbol)} net</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground mt-2">—</p>
      )}
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