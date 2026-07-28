"use client"

import { useState, useEffect } from "react"
import { FileText, TrendingUp, TrendingDown, DollarSign, Users, PieChart, Receipt } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "../types"
import type { CircleData } from "../types"

interface ReportsTabProps { circle: CircleData; circleId: string; projectId: string }

export function ReportsTab({ circle, circleId, projectId }: ReportsTabProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/reports`)
        if (!cancelled && r.ok) setData(await r.json())
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId])

  const symbol = circle?.currency || "ZAR"
  const roi = data?.roi
  const funding = data?.funding
  const ownership = data?.ownership

  if (loading) return <ReportsSkeleton />
  if (!data) return <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">Failed to load report data</p></CardContent></Card>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard icon={<DollarSign className="size-4" />} label="Revenue" value={formatCurrency(roi?.totalRevenueNet ?? 0, symbol)} color="text-emerald-600" />
        <MetricCard icon={<TrendingDown className="size-4" />} label="Expenses" value={formatCurrency(roi?.totalExpensesPaid ?? 0, symbol)} color="text-red-500" />
        <MetricCard icon={<TrendingUp className="size-4" />} label="Net Profit" value={formatCurrency(roi?.netProfit ?? 0, symbol)} color={(roi?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} />
        <MetricCard icon={<TrendingUp className="size-4" />} label="ROI" value={`${roi?.roi ?? 0}%`} color={(roi?.roi ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} />
        <MetricCard icon={<DollarSign className="size-4" />} label="Raised" value={formatCurrency(funding?.raised ?? 0, symbol)} />
        <MetricCard icon={<Receipt className="size-4" />} label="Exp. Approved" value={formatCurrency(roi?.totalExpensesApproved ?? 0, symbol)} />
        <MetricCard icon={<Users className="size-4" />} label="Owners" value={String(ownership?.count ?? 0)} />
        <MetricCard icon={<PieChart className="size-4" />} label="Ownership %" value={`${ownership?.total ?? 0}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Breakdown</CardTitle></CardHeader><CardContent>
          <div className="space-y-2 text-sm">
            <Row label="Gross Revenue" value={formatCurrency(roi?.totalRevenueGross ?? 0, symbol)} />
            <Row label="Direct Costs" value={formatCurrency(roi?.totalDirectCosts ?? 0, symbol)} />
            <Row label="Net Revenue" value={formatCurrency(roi?.totalRevenueNet ?? 0, symbol)} bold />
          </div>
        </CardContent></Card>

        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-sm">Profitability</CardTitle></CardHeader><CardContent>
          <div className="space-y-2 text-sm">
            <Row label="Gross Profit" value={formatCurrency(roi?.grossProfit ?? 0, symbol)} />
            <Row label="Net Profit" value={formatCurrency(roi?.netProfit ?? 0, symbol)} bold />
            <Row label="Break-even" value={`${roi?.breakEvenMonths ?? 0} months`} />
            <Row label="Depreciation" value={formatCurrency(roi?.totalDepreciation ?? 0, symbol)} />
          </div>
        </CardContent></Card>

        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-sm">Asset Summary</CardTitle></CardHeader><CardContent>
          <div className="space-y-2 text-sm">
            <Row label="Total Purchase" value={formatCurrency(roi?.totalAssetPurchase ?? 0, symbol)} />
            <Row label="Current Value" value={formatCurrency(roi?.totalCurrentAssetValue ?? 0, symbol)} />
            <Row label="Sale Value" value={formatCurrency(roi?.totalSaleValue ?? 0, symbol)} />
          </div>
        </CardContent></Card>

        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-sm">Funding Summary</CardTitle></CardHeader><CardContent>
          <div className="space-y-2 text-sm">
            <Row label="Total Raised" value={formatCurrency(funding?.raised ?? 0, symbol)} />
            <Row label="Total Target" value={formatCurrency(funding?.totalTarget ?? 0, symbol)} />
            <Row label="Committed" value={formatCurrency(funding?.totalCommitted ?? 0, symbol)} />
            <Row label="Paid" value={formatCurrency(funding?.totalPaid ?? 0, symbol)} />
          </div>
        </CardContent></Card>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={bold ? "font-bold" : ""}>{value}</span></div>
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-base sm:text-lg font-bold ${color || ""}`}>{value}</p></CardContent></Card>
}

function ReportsSkeleton() {
  return <div className="space-y-4"><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}</div><div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-5 w-full" />)}</CardContent></Card>)}</div></div>
}
