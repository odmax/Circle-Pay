import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, PiggyBank, Users, Target, Wallet, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getMemberCircleStatus } from "@/lib/services/member-status.service"
import { StatCard } from "@/components/ui/app/cards"
import { CURRENCIES } from "@/lib/constants"

export default async function MyStatusPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let status
  try { status = await getMemberCircleStatus(circleId, session.user.id) } catch { notFound() }
  const s = status
  const symbol = CURRENCIES.find((c) => c.code === "ZAR")?.symbol || "R"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">My Status</h1><p className="text-muted-foreground">{s.circle.name} · {s.member.role}</p></div>
      </div>

      {/* Warnings */}
      {s.warnings.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">{s.warnings.map((w, i) => <p key={i} className="text-sm text-amber-800">{w}</p>)}</div>
        </CardContent></Card>
      )}

      {/* Financial Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Contributions" value={`${symbol}${s.contributions.total.toLocaleString()}`} sub={`${symbol}${s.contributions.thisMonth.toLocaleString()} this month`} />
        <StatCard label="Owed by Me" value={`${symbol}${s.balances.owedByMe.toLocaleString()}`} sub={s.balances.owedByMe > 0 ? "Settle with members" : "All settled"} />
        <StatCard label="Owed to Me" value={`${symbol}${s.balances.owedToMe.toLocaleString()}`} sub={s.balances.owedToMe > 0 ? "Awaiting settlement" : "All caught up"} />
        <StatCard label="Due Items" value={String(s.payments.pending + s.payments.overdue)} sub={s.payments.overdue > 0 ? `${s.payments.overdue} overdue` : s.payments.pending > 0 ? `${s.payments.pending} pending` : "All paid"} />
      </div>

      {/* Stokvel/Investment specific */}
      {s.stokvel && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Payout Status</CardTitle></CardHeader><CardContent>
          {s.stokvel.date ? <div className="text-center"><p className="text-2xl font-bold text-brand mb-1">{symbol}{s.stokvel.amount?.toLocaleString()}</p><p className="text-sm text-muted-foreground">Payout #{s.stokvel.position} · {new Date(s.stokvel.date).toLocaleDateString()}</p></div>
          : <p className="text-sm text-muted-foreground text-center">{(s.stokvel as any).message || "Not your payout turn"}</p>}
        </CardContent></Card>
      )}

      {s.investment && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">My Investment</CardTitle></CardHeader><CardContent className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-sm">Capital Contributed</span><span className="font-mono font-bold">{symbol}{s.investment.capitalContributed.toLocaleString()}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm">Ownership Share</span><span className="font-bold">{s.investment.ownership}%</span></div>
        </CardContent></Card>
      )}

      {/* Goals */}
      {s.goals.myAllocations.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">My Goals</CardTitle></CardHeader><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Goal</th><th className="p-3">Target</th><th className="p-3">My Share</th></tr></thead>
            <tbody>{s.goals.myAllocations.map((g, i) => <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4 font-medium">{g.goal}</td><td className="p-3">{symbol}{g.target.toLocaleString()}</td><td className="p-3">{symbol}{g.myShare.toLocaleString()}</td></tr>)}</tbody>
          </table>
        </CardContent></Card>
      )}

      {/* Next Actions */}
      {s.nextActions.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Next Actions</CardTitle></CardHeader><CardContent>
          <div className="flex flex-wrap gap-2">
            {s.nextActions.map((a) => <Link key={a.label} href={a.href}><Button variant="outline" size="sm" className="rounded-xl">{a.label}</Button></Link>)}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}
