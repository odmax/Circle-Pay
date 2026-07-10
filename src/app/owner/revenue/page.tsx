import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from "lucide-react"
import { getOwnerRevenue } from "@/lib/services/owner.service"
import { Badge } from "@/components/ui/badge"

export default async function OwnerRevenuePage({ searchParams }: { searchParams: Promise<{ startDate?: string; endDate?: string; planId?: string; provider?: string }> }) {
  const filters = await searchParams
  const data = await getOwnerRevenue(filters)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <Link href={`/api/owner/revenue/export.csv?${new URLSearchParams(filters as any).toString()}`} className="text-sm text-brand hover:underline">Export CSV</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">MRR</CardTitle><TrendingUp className="size-4 text-emerald-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">R{data.mrr.toLocaleString()}</div><p className="text-xs text-muted-foreground">This month</p></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">ARR</CardTitle><BarChart3 className="size-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">R{data.arr.toLocaleString()}</div><p className="text-xs text-muted-foreground">This year</p></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle><DollarSign className="size-4 text-emerald-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">R{data.totalRevenue.toLocaleString()}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Success Rate</CardTitle><TrendingDown className="size-4 text-amber-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{data.successRate}%</div><p className="text-xs text-muted-foreground">{data.successCount} paid / {data.failCount} failed</p></CardContent></Card>
      </div>

      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Revenue by Plan</CardTitle></CardHeader><CardContent>
        <div className="space-y-2">{data.byPlan.map((b, i) => (<div key={i} className="flex justify-between text-sm"><span>{b.plan}</span><span className="font-medium">R{b.revenue.toLocaleString()} ({b.count} payments)</span></div>))}</div>
      </CardContent></Card>

      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader><CardContent>
        <div className="space-y-1">{data.dailyRevenue.slice(0, 20).map((d, i) => (
          <div key={i} className="flex justify-between text-sm"><span>{d.date}</span><span className="font-mono">R{d.amount.toLocaleString()}</span></div>
        ))}</div>
      </CardContent></Card>
    </div>
  )
}
