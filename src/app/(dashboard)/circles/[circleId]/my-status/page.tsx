import { notFound, redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, PiggyBank, Users, Target, Wallet, DollarSign, CalendarClock, Hourglass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getMemberCircleStatus } from "@/lib/services/member-status.service"
import { StatCard } from "@/components/ui/app/cards"
import { CURRENCIES } from "@/lib/constants"

const VERIFICATION_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending Verification", color: "border-amber-200 bg-amber-50 text-amber-700" },
  VERIFIED: { label: "Auto Verified", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  NEEDS_REVIEW: { label: "Needs Review", color: "border-blue-200 bg-blue-50 text-blue-700" },
  REJECTED: { label: "Verification Rejected", color: "border-red-200 bg-red-50 text-red-700" },
}

export default async function MyStatusPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let status, pageError: string | null = null
  try { status = await getMemberCircleStatus(circleId, session.user.id) } catch (e) { pageError = (e as Error).message; console.error("MyStatus error:", e) }
  const s = status
  const symbol = s?.circle?.currency ? CURRENCIES.find((c) => c.code === s.circle.currency)?.symbol || s.circle.currency : "R"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">My Status</h1>{s && <p className="text-muted-foreground">{s.circle.name} · {s.member.role}</p>}</div>
      </div>

      {/* Error state */}
      {pageError && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div><p className="font-medium text-amber-800">Could not load your status</p><p className="text-xs text-amber-700 mt-1">{pageError}</p></div>
        </CardContent></Card>
      )}
      {!pageError && s && (<>
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

      {/* Contribution Schedule */}
      {s.schedule && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Next Contribution
                </CardTitle>
                <CalendarClock className="size-4 text-brand" />
              </CardHeader>
              <CardContent>
                {s.schedule.nextDue ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-brand">
                      {symbol}{s.schedule.nextDue.amount.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Due {new Date(s.schedule.nextDue.dueDate).toLocaleDateString()}
                      {s.schedule.nextDue.periodLabel ? ` · ${s.schedule.nextDue.periodLabel}` : ""}
                    </p>
                    <Badge
                      variant="outline"
                      className={`border text-xs font-medium ${
                        s.schedule.nextDue.daysRemaining > 3
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : s.schedule.nextDue.daysRemaining >= 0
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {s.schedule.nextDue.daysRemaining > 0
                        ? `${s.schedule.nextDue.daysRemaining} day${s.schedule.nextDue.daysRemaining === 1 ? "" : "s"} remaining`
                        : s.schedule.nextDue.daysRemaining === 0
                        ? "Due today"
                        : `${Math.abs(s.schedule.nextDue.daysRemaining)} day${Math.abs(s.schedule.nextDue.daysRemaining) === 1 ? "" : "s"} overdue`}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming contribution scheduled</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Outstanding Balance
                </CardTitle>
                <Hourglass className="size-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {symbol}{s.schedule.outstandingBalance.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.schedule.overdue.length > 0
                    ? `${s.schedule.overdue.length} overdue contribution${s.schedule.overdue.length === 1 ? "" : "s"}`
                    : "All contributions up to date"}
                </p>
              </CardContent>
            </Card>
          </div>

          {s.schedule.overdue.length > 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader><CardTitle className="text-base">Overdue Contributions</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="p-3 pl-4">Period</th><th className="p-3">Amount</th><th className="p-3">Due Date</th><th className="p-3">Overdue</th><th className="p-3">Late Fee</th>
                  </tr></thead>
                  <tbody>
                    {s.schedule.overdue.map((o, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="p-3 pl-4 font-medium">{o.periodLabel || "—"}</td>
                        <td className="p-3 font-mono">{symbol}{o.amount.toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">{o.dueDate ? new Date(o.dueDate).toLocaleDateString() : "—"}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">
                            {o.daysOverdue}d overdue
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{o.lateFee ? `${symbol}${o.lateFee}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {s.schedule.history.length > 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="p-3 pl-4">Date</th><th className="p-3">Period</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Verification</th>
                  </tr></thead>
                  <tbody>
                    {s.schedule.history.map((c, i) => {
                      const vb = VERIFICATION_BADGE[c.verificationStatus as string]
                      return (
                        <tr key={c.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 pl-4 text-muted-foreground">{new Date(c.date).toLocaleDateString()}</td>
                          <td className="p-3">{c.periodLabel || "—"}</td>
                          <td className="p-3 font-mono">{symbol}{c.amount.toLocaleString()}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={`border text-[10px] ${c.status === "PAID" || c.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : c.status === "OVERDUE" ? "border-red-200 bg-red-50 text-red-700" : c.status === "UPCOMING" ? "border-slate-200 bg-slate-50 text-slate-600" : c.status === "DUE" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                              {c.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {vb ? <Badge variant="outline" className={`border text-[10px] ${vb.color}`}>{vb.label}</Badge> : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
      </>)}
      {!pageError && s && s.nextActions.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Next Actions</CardTitle></CardHeader><CardContent>
          <div className="flex flex-wrap gap-2">
            {s.nextActions.map((a) => <Link key={a.label} href={a.href}><Button variant="outline" size="sm" className="rounded-xl">{a.label}</Button></Link>)}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}
