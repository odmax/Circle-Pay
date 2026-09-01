"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Lock, ShieldAlert, TrendingDown, Wallet,
  PiggyBank, Scale, Download, RefreshCcw, AlertTriangle, FileBarChart, Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { CURRENCIES } from "@/lib/constants"

type ReviewRow = { userId: string; name: string; contributions: number; memberPaidExpenses: number; share: number; settledGiven: number; settledReceived: number; refundAvailable: number; amountOwed: number; finalBalance: number }
type Blocker = { id: string; level: string; title: string; description: string }

function money(n: number, code: string): string {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

const STEPS = [
  ["COMPLETED", "Completed"],
  ["RECONCILING", "Reconciling"],
  ["PENDING_SETTLEMENT", "Settlements"],
  ["CLOSED", "Closed & finalized"],
]

export function TravelClose({ circleId, circleName, currency, canManage }: {
  circleId: string
  circleName: string
  currency: string
  canManage: boolean
}) {
  const [review, setReview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const symbol = currency || "ZAR"

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/travel/close`)
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setReview(j)
      } catch { /* keep */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }

  const runAction = async (action: string, force = false) => {
    const r = await fetch(`/api/circles/${circleId}/travel/close?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) })
    if (!r.ok) { const m = (await r.json().catch(() => ({}))).error || "Failed"; toast.error(m); return }
    toast.success("Done"); refresh()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Card className="rounded-2xl"><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-12 w-full" /></CardContent></Card></div>
  if (!review) return <Card className="rounded-2xl"><CardContent className="py-14 text-center"><p className="font-medium">Could not load the trip close review</p><Button variant="outline" className="rounded-xl mt-3" onClick={refresh}>Retry</Button></CardContent></Card>

  const t = review.trip
  const totals = review.totals
  const stepIdx = STEPS.findIndex(([s]) => s === t.status)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`/circles/${circleId}/trip`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Trip Close & Final Reconciliation</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} · {t.name}{t.destination ? ` · ${t.destination}` : ""}</p>
        </div>
      </div>

      {/* Workflow progress */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {STEPS.map(([s, label], i) => (
              <div key={s} className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`size-4 rounded-full shrink-0 ${i <= stepIdx ? "bg-brand" : "bg-muted"}`} />
                <span className={`text-xs shrink-0 ${i <= stepIdx ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
                {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < stepIdx ? "bg-brand" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">{review.statusProgress}% complete · status {t.status.replace(/_/g, " ")}{t.finalizedAt ? ` · finalized ${new Date(t.finalizedAt).toDateString()}` : ""}</p>
          {canManage && t.status === "COMPLETED" && (
            <Button className="rounded-xl bg-brand hover:bg-brand-600 mt-3" onClick={() => runAction("reconcile")}><RefreshCcw className="size-4 mr-1" /> Start reconciliation</Button>
          )}
          {canManage && t.status === "RECONCILING" && (
            <Button className="rounded-xl bg-brand hover:bg-brand-600 mt-3" onClick={() => runAction("settle")}><Scale className="size-4 mr-1" /> Begin settlement phase</Button>
          )}
          {canManage && t.status === "PENDING_SETTLEMENT" && (
            <>
              <Button className="rounded-xl bg-brand hover:bg-brand-600 mt-3" onClick={() => setConfirmFinalize(true)}><Lock className="size-4 mr-1" /> Finalize trip</Button>
              <Button variant="ghost" className="rounded-xl mt-3 ml-2" onClick={() => runAction("reopen")}><RefreshCcw className="size-4 mr-1" /> Reopen (audited)</Button>
            </>
          )}
          {canManage && t.status === "CLOSED" && (
            <Button variant="ghost" className="rounded-xl mt-3" onClick={() => runAction("reopen")}><RefreshCcw className="size-4 mr-1" /> Reopen for adjustments (audited)</Button>
          )}
        </CardContent>
      </Card>

      {/* Blockers */}
      {[...(review.blockers.hard || []), ...(review.blockers.soft || [])].length > 0 && (
        <div className="space-y-1.5">
          {review.blockers.hard.map((b: Blocker) => <div key={b.id} className="flex gap-2 text-sm p-3 rounded-xl border border-red-200 bg-red-50/50 text-red-800"><ShieldAlert className="size-4 shrink-0 mt-0.5" /><div><p className="font-medium">{b.title}</p><p className="text-xs opacity-80">{b.description}</p></div></div>)}
          {review.blockers.soft.map((b: Blocker) => <div key={b.id} className="flex gap-2 text-sm p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-800"><AlertTriangle className="size-4 shrink-0 mt-0.5" /><div><p className="font-medium">{b.title}</p><p className="text-xs opacity-80">{b.description}</p></div></div>)}
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<Wallet className="size-4" />} label="Contributions" value={money(totals.totalContributions, symbol)} />
        <Widget icon={<TrendingDown className="size-4" />} label="Trip spending" value={money(totals.totalSpent, symbol)} />
        <Widget icon={<PiggyBank className="size-4" />} label="Budget variance" value={money(totals.variance, symbol)} tone={totals.variance < 0 ? "text-red-500" : "text-emerald-600"} />
        <Widget icon={<Scale className="size-4" />} label="Settlements" value={money(totals.totalSettlements, symbol)} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<FileBarChart className="size-4" />} label="Collection rate" value={`${totals.collectionRate}%`} />
        <Widget icon={<Users className="size-4" />} label="Per-person cost" value={money(totals.perPersonCost, symbol)} />
        <Widget icon={<PiggyBank className="size-4" />} label="Remaining funds" value={money(totals.remainingFunds, symbol)} tone={totals.remainingFunds > 0 ? "text-amber-600" : ""} />
        <Widget icon={<Lock className="size-4" />} label="Duration" value={`${totals.durationDays} days`} />
      </div>

      {/* My statement */}
      {review.my && (
        <Card className="rounded-2xl border-brand/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2"><FileBarChart className="size-4 text-brand" /><h3 className="font-semibold">My final statement</h3></div>
              <div className="flex items-center gap-2">
                <a href={`/api/circles/${circleId}/travel/statement`} className={`inline-flex items-center rounded-xl ${t.status === "CLOSED" ? "bg-brand text-white hover:bg-brand-600" : "border"} px-3 py-1.5 text-sm font-medium ${t.status === "CLOSED" ? "" : "text-muted-foreground"}`}><Download className="size-4 mr-1" /> Statement PDF</a>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 mt-4 gap-3">
              <Mini label="Contributions" value={money(review.my.contributions, symbol)} />
              <Mini label="Expenses paid" value={money(review.my.memberPaidExpenses, symbol)} />
              <Mini label="Expense share" value={money(review.my.share, symbol)} />
              <Mini label="Final balance" value={money(review.my.finalBalance, symbol)} tone={review.my.finalBalance >= 0 ? "text-emerald-600" : "text-red-500"} />
              <Mini label="Refund available" value={money(review.my.refundAvailable, symbol)} tone={review.my.refundAvailable > 0 ? "text-emerald-600" : ""} />
              <Mini label="Amount owed" value={money(review.my.amountOwed, symbol)} tone={review.my.amountOwed > 0 ? "text-amber-600" : ""} />
              <Mini label="Settled received" value={money(review.my.settledReceived, symbol)} />
              <Mini label="Settled given" value={money(review.my.settledGiven, symbol)} />
            </div>
            {t.status !== "CLOSED" && <p className="text-[10px] text-muted-foreground mt-2">Live figures — final statement is generated when the trip is finalized.</p>}
          </CardContent>
        </Card>
      )}

      {/* Reconciliation table */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Final member balances</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead><tr className="text-left text-[11px] text-muted-foreground border-b">
              <th className="py-1.5 pr-3">Member</th><th className="py-1.5 pr-3">Contributions</th><th className="py-1.5 pr-3">Paid</th><th className="py-1.5 pr-3">Share</th><th className="py-1.5 pr-3">Settled</th><th className="py-1.5 pr-3">Refund</th><th className="py-1.5">Owed</th>
            </tr></thead>
            <tbody>
              {review.rows.map((r: ReviewRow) => (
                <tr key={r.userId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.name}</td>
                  <td className="py-2 pr-3">{money(r.contributions, symbol)}</td>
                  <td className="py-2 pr-3">{money(r.memberPaidExpenses, symbol)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{money(r.share, symbol)}</td>
                  <td className="py-2 pr-3">{money(r.settledReceived - r.settledGiven, symbol)}</td>
                  <td className={`py-2 pr-3 ${r.refundAvailable > 0 ? "text-emerald-600 font-medium" : ""}`}>{money(r.refundAvailable, symbol)}</td>
                  <td className={`py-2 ${r.amountOwed > 0 ? "text-red-500 font-medium" : ""}`}>{money(r.amountOwed, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(review.membersOwing.length > 0 || review.refundsDue.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {review.membersOwing.length > 0 && (
            <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Settlement required</CardTitle></CardHeader><CardContent className="space-y-1.5">
              {review.membersOwing.map((o: any) => <div key={o.userId} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2"><span className="min-w-0 truncate">{o.name}</span><span className="font-semibold shrink-0">{money(o.amount, symbol)}</span></div>)}
            </CardContent></Card>
          )}
          {review.refundsDue.length > 0 && (
            <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-600">Refunds available</CardTitle></CardHeader><CardContent className="space-y-1.5">
              {review.refundsDue.map((r: any) => <div key={r.userId} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2"><span className="min-w-0 truncate">{r.name}</span><span className="font-semibold shrink-0">{money(r.amount, symbol)}</span></div>)}
            </CardContent></Card>
          )}
        </div>
      )}

      <FinalizeDialog open={confirmFinalize} onOpenChange={setConfirmFinalize} onConfirm={() => { setConfirmFinalize(false); runAction("finalize", true) }} blockerCount={review.blockers.hard.length} />
    </div>
  )
}

function Widget({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{value}</p></CardContent></Card>
}
function Mini({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${tone}`}>{value}</p></div>
}

function FinalizeDialog({ open, onOpenChange, onConfirm, blockerCount }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; blockerCount: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Finalize trip</DialogTitle><DialogDescription>{blockerCount > 0 ? "Hard blockers remain. Finalize with force will bypass them — resolve instead if possible." : "Finalize locks the financial period and generates per-member statement snapshots."}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={onConfirm}><Lock className="size-4 mr-1" /> Finalize</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}