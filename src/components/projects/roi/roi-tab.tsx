"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, Box, Receipt, Clock, CheckCircle2, PieChart } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, ASSET_TYPE_LABELS, ASSET_STATUS_COLORS, REVENUE_TYPE_LABELS } from "../types"
import type { ROIDashboardData, CircleData } from "../types"

interface ROITabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

export function ROITab({ circle, circleId, projectId }: ROITabProps) {
  const [data, setData] = useState<ROIDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/roi`)
        if (!cancelled && r.ok) setData(await r.json())
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId])

  const symbol = circle?.currency || "ZAR"
  const summary = data?.summary

  if (loading) return <ROISkeleton />
  if (!data) return <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">Failed to load ROI data</p></CardContent></Card>

  const roiColor = (summary?.roi ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard icon={<DollarSign className="size-4" />} label="Raised" value={formatCurrency(summary?.raised ?? 0, symbol)} />
        <MetricCard icon={<TrendingUp className="size-4" />} label="Gross Revenue" value={formatCurrency(summary?.totalRevenueGross ?? 0, symbol)} color="text-emerald-600" />
        <MetricCard icon={<TrendingDown className="size-4" />} label="Expenses Paid" value={formatCurrency(summary?.totalExpensesPaid ?? 0, symbol)} color="text-red-500" />
        <MetricCard icon={<DollarSign className="size-4" />} label="Net Profit" value={formatCurrency(summary?.netProfit ?? 0, symbol)} color={(summary?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} />
        <MetricCard icon={<CheckCircle2 className="size-4" />} label="ROI" value={`${summary?.roi ?? 0}%`} color={roiColor} />
        <MetricCard icon={<Box className="size-4" />} label="Asset Value" value={formatCurrency(summary?.totalCurrentAssetValue ?? 0, symbol)} />
        <MetricCard icon={<TrendingDown className="size-4" />} label="Depreciation" value={formatCurrency(summary?.totalDepreciation ?? 0, symbol)} />
        <MetricCard icon={<Clock className="size-4" />} label="Break-even" value={`${summary?.breakEvenMonths ?? 0} months`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Box className="size-4" /> Assets</CardTitle></CardHeader>
          <CardContent>
            {data.assets.length === 0 ? <p className="text-sm text-muted-foreground py-2">No assets</p> : (
              <div className="space-y-2">
                {data.assets.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-xl border">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{a.name}</p><Badge className={`text-[10px] ${ASSET_STATUS_COLORS[a.status] || ""}`}>{a.status}</Badge></div>
                      <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[a.type] || a.type}{a.currentValue ? ` · Value: ${formatCurrency(Number(a.currentValue), symbol)}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4" /> Recent Revenue</CardTitle></CardHeader>
          <CardContent>
            {data.revenues.length === 0 ? <p className="text-sm text-muted-foreground py-2">No revenue recorded</p> : (
              <div className="space-y-2">
                {data.revenues.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-xl border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.description || REVENUE_TYPE_LABELS[r.type] || r.type}</p>
                      <p className="text-xs text-muted-foreground">{r.asset?.name ? `Asset: ${r.asset.name} · ` : ""}Net: {formatCurrency(Number(r.amount), symbol)}</p>
                    </div>
                    <Badge className="text-[10px] shrink-0">{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="size-4" /> Financial Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground">Gross Profit</p><p className="font-bold">{(summary?.grossProfit ?? 0) >= 0 ? "+" : ""}{formatCurrency(summary?.grossProfit ?? 0, symbol)}</p></div>
            <div><p className="text-muted-foreground">Direct Costs</p><p className="font-bold">{formatCurrency(summary?.totalDirectCosts ?? 0, symbol)}</p></div>
            <div><p className="text-muted-foreground">Asset Purchase</p><p className="font-bold">{formatCurrency(summary?.totalAssetPurchase ?? 0, symbol)}</p></div>
            <div><p className="text-muted-foreground">Asset Sale Value</p><p className="font-bold">{formatCurrency(summary?.totalSaleValue ?? 0, symbol)}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div>
        <p className={`text-base sm:text-lg font-bold ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function ROISkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-8 w-full" />)}</CardContent></Card>)}
      </div>
    </div>
  )
}
