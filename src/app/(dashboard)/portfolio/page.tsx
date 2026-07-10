import { redirect } from "next/navigation"
import Link from "next/link"
import { PiggyBank, TrendingUp, DollarSign, FolderKanban } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getMemberProjectPortfolio } from "@/lib/services/project-distribution.service"
import { StatCard } from "@/components/ui/app/cards"

export default async function PortfolioPage() {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const portfolio = await getMemberProjectPortfolio(session.user.id).catch(() => null)
  if (!portfolio) return <div className="p-8 text-muted-foreground">No investments yet</div>
  const symbol = "R"
  const projects = [...new Set(portfolio.contributions.map((c: any) => c.project?.id))].length
  const paidDistributions = portfolio.distributionItems.filter((d: any) => d.status === "PAID")
  const totalDistributed = paidDistributions.reduce((s: number, d: any) => s + Number(d.profitShare), 0)

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">My Portfolio</h1><p className="text-muted-foreground">Investments across all your circles</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Invested" value={`${symbol}${portfolio.totalInvested.toLocaleString()}`} />
        <StatCard label="Projects" value={String(projects)} />
        <StatCard label="Profit Distributed" value={`${symbol}${totalDistributed.toLocaleString()}`} />
        <StatCard label="All Time ROI" value={portfolio.totalInvested > 0 ? `${Math.round((totalDistributed / portfolio.totalInvested) * 100)}%` : "—"} />
      </div>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Project Investments</CardTitle></CardHeader><CardContent className="p-0">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Project</th><th className="p-3">Contribution</th><th className="p-3">Status</th></tr></thead>
          <tbody>{portfolio.contributions.map((c: any) => (
            <tr key={c.id} className="border-b hover:bg-muted/30">
              <td className="p-3 pl-4"><Link href={`/circles/${c.project?.circleId}/projects/${c.project?.id}`} className="font-medium hover:underline">{c.project?.name || "—"}</Link></td>
              <td className="p-3">{symbol}{Number(c.amount).toLocaleString()}</td>
              <td className="p-3"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">CONFIRMED</Badge></td>
            </tr>
          ))}</tbody></table>
        </CardContent></Card>
      {paidDistributions.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Distributions Received</CardTitle></CardHeader><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Distribution</th><th className="p-3">Amount</th><th className="p-3">Status</th></tr></thead>
            <tbody>{paidDistributions.map((d: any) => (
              <tr key={d.id} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{d.distribution?.name || "Distribution"}</td><td className="p-3 text-emerald-600">{symbol}{Number(d.profitShare).toLocaleString()}</td><td className="p-3"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">PAID</Badge></td></tr>
            ))}</tbody></table>
          </CardContent></Card>
      )}
    </div>
  )
}
