"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Home, Settings2, Wallet, PiggyBank, TrendingDown, Users, Clock, Receipt,
  ArrowUpRight, BellRing, ShieldAlert, Scale, AlertTriangle, Info, Plus, RefreshCcw, Upload, ShoppingCart, ClipboardCheck, KeyRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatDate } from "@/components/projects/types"
import { CURRENCIES } from "@/lib/constants"

type Bound = { config: any; metrics: any; rentStatus: { paid: boolean; status: string; label: string }; nextRentDue: string; my: any; upcomingBills: Array<{ id: string; name: string; amount: number; dueDate: string | null }>; expenses: Array<{ id: string; title: string; amount: number; category: string; expenseDate: string; receiptUrl: string | null; paidByName: string | null }>; balances: any; notices: Array<{ id: string; content: string; createdAt: string; authorName: string | null }>; alerts: Array<{ id: string; level: string; title: string; description: string }>; billsSummary?: any; groceries?: any; chores?: any; lease?: any }
type BillInstance = { id: string; billId: string; name: string; category: string; provider: string | null; status: string; expected: number; actual: number | null; paid: number; outstanding: number; dueDate: string | null; responsibleMemberId: string | null; myShare: number; myPaid: number; myOutstanding: number; billFileUrl: string | null }

function money(n: number, code: string): string {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

const RENT_COLORS: Record<string, string> = {
  none: "border-slate-200 bg-slate-50 text-slate-600",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  due_soon: "border-amber-200 bg-amber-50 text-amber-700",
  upcoming: "border-blue-200 bg-blue-50 text-blue-700",
}
const BILL_COLORS: Record<string, string> = {
  UPCOMING: "border-slate-200 bg-slate-50 text-slate-600",
  DUE: "border-amber-200 bg-amber-50 text-amber-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  PARTIALLY_PAID: "border-purple-200 bg-purple-50 text-purple-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

export function HouseholdDashboard({ circleId, circleName, currency, canManage }: {
  circleId: string
  circleName: string
  currency: string
  canManage: boolean
}) {
  const [data, setData] = useState<Bound | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showSetup, setShowSetup] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [showCreateBill, setShowCreateBill] = useState(false)
  const [payingBill, setPayingBill] = useState<BillInstance | null>(null)
  const [actualBill, setActualBill] = useState<BillInstance | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/household`)
        if (!r.ok) throw new Error("failed")
        const j = await r.json()
        if (!cancelled) setData(j)
      } catch { if (!cancelled) setData(null as unknown as Bound) } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }

  const sendReminders = async () => {
    setReminding(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/remind`, { method: "POST" })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Reminders sent to outstanding members")
    } catch (e) { toast.error((e as Error).message) } finally { setReminding(false) }
  }

  if (loading) return <HouseholdSkeleton />

  if (!data || !data.config) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Household</h1><p className="text-muted-foreground">{circleName} — run the shared home</p></div></div>
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Home className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Household not configured yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Set the rent, address and bills so everyone can see what they owe and have paid.</p>
          {canManage ? <Button className="mt-4 rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowSetup(true)}><Settings2 className="size-4 mr-1" /> Set up household</Button> : <p className="mt-4 text-xs text-muted-foreground">Only household managers can configure this home.</p>}
        </CardContent></Card>
        <SetupDialog open={showSetup} onOpenChange={setShowSetup} circleId={circleId} currency={currency} config={null} onSaved={refresh} />
      </div>
    )
  }

  const symbol = data.config.currency || "ZAR"
  const base = `/circles/${circleId}`
  const m = data.metrics

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{data.config.name}</h1>
            <Badge variant="outline" className={`text-[10px] ${RENT_COLORS[data.rentStatus.status] || ""}`}>{data.rentStatus.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{circleName}{data.config.address ? ` · ${data.config.address}` : ""} · {data.config.rooms} room(s)</p>
          {data.config.rules && <p className="text-xs text-muted-foreground mt-1 italic">{data.config.rules}</p>}
        </div>
        {canManage && <div className="flex items-center gap-2 shrink-0 flex-wrap"><Button variant="outline" className="rounded-xl h-8" onClick={() => setShowSetup(true)}><Settings2 className="size-3.5 mr-1" /> Configure</Button><Button variant="outline" className="rounded-xl h-8" onClick={sendReminders} disabled={reminding}><BellRing className="size-3.5 mr-1" /> {reminding ? "Sending..." : "Remind"}</Button></div>}
      </div>

      <div className="space-y-1.5">
        {data.alerts.map((a) => (
          <div key={a.id} className={`flex gap-3 text-sm p-3 rounded-xl border ${a.level === "risk" ? "border-red-200 bg-red-50/50 text-red-800" : a.level === "warning" ? "border-amber-200 bg-amber-50/50 text-amber-800" : "border-sky-200 bg-sky-50/40 text-sky-800"}`}>
            {a.level === "risk" ? <ShieldAlert className="size-4 shrink-0 mt-0.5" /> : a.level === "warning" ? <AlertTriangle className="size-4 shrink-0 mt-0.5" /> : <Info className="size-4 shrink-0 mt-0.5" />}
            <div className="min-w-0"><p className="font-medium">{a.title}</p><p className="text-xs opacity-80">{a.description}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<Wallet className="size-4" />} label="Monthly cost" value={money(m.monthlyHouseholdCost, symbol)} />
        <Widget icon={<PiggyBank className="size-4" />} label="Rent paid" value={`${money(m.rentPaid, symbol)} · outstanding ${money(m.rentOutstanding, symbol)}`} tone={m.rentOutstanding > 0 ? "text-amber-600" : "text-emerald-600"} />
        <Widget icon={<TrendingDown className="size-4" />} label="Utilities this month" value={money(m.utilitiesThisMonth, symbol)} />
        <Widget icon={<Receipt className="size-4" />} label="Shared expenses" value={money(m.sharedThisMonth, symbol)} />
        <Widget icon={<Wallet className="size-4" />} label="Household balance" value={money(m.householdBalance, symbol)} tone={m.householdBalance < 0 ? "text-red-500" : ""} />
        <Widget icon={<Users className="size-4" />} label="Members paid" value={`${m.membersPaid}/${m.memberCount || 0}`} />
        <Widget icon={<Clock className="size-4" />} label="Next rent due" value={formatDate(data.nextRentDue)} />
        <Widget icon={<Scale className="size-4" />} label="Settlements outstanding" value={String(data.balances?.allBalances?.length || 0)} tone={(data.balances?.allBalances?.length || 0) > 0 ? "text-amber-600" : ""} />
      </div>

      {data.groceries && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Widget icon={<ShoppingCart className="size-4" />} label="Groceries this month" value={money(data.groceries.groceriesThisMonth || 0, symbol)} />
          <Widget icon={<Wallet className="size-4" />} label="Shared purchases" value={money(data.groceries.sharedThisMonth || 0, symbol)} />
          <Widget icon={<PiggyBank className="size-4" />} label="My household spend" value={money(data.groceries.mySpend || 0, symbol)} />
          <Widget icon={<Scale className="size-4" />} label="Owed to me (purchases)" value={money(data.groceries.amountOwedToMe || 0, symbol)} tone={(data.groceries.amountOwedToMe || 0) > 0 ? "text-emerald-600" : ""} />
          <Widget icon={<Users className="size-4" />} label="Who paid recently" value={data.groceries.lastPayer || "—"} />
          <Widget icon={<ShoppingCart className="size-4" />} label="Upcoming grocery run" value={data.groceries.upcomingRun ? data.groceries.upcomingRun.title : "—"} sub={data.groceries.upcomingRun ? `${data.groceries.upcomingRun.status.replace(/_/g, " ")} · ${data.groceries.upcomingRun.purchasedCount}/${data.groceries.upcomingRun.totalItems} bought` : ""} />
          <Widget icon={<Scale className="size-4" />} label="Unsettled purchase balances" value={String(data.groceries.unsettledBalances || 0)} tone={(data.groceries.unsettledBalances || 0) > 0 ? "text-amber-600" : ""} />
          <div className="rounded-2xl border p-3 flex items-center justify-center"><Link href={`${base}/groceries`} className="inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"><ShoppingCart className="size-3.5 mr-1" /> Open Groceries</Link></div>
        </div>
      )}

      {data.lease && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Widget icon={<KeyRound className="size-4" />} label="Lease expiry" value={data.lease.leaseStatus ? data.lease.leaseStatus : "—"} sub={data.lease.daysLeft != null ? `${data.lease.daysLeft} days left` : ""} tone={data.lease.leaseStatus === "EXPIRING" ? "text-amber-600" : data.lease.leaseStatus === "ENDED" ? "text-red-500" : ""} />
          <Widget icon={<Home className="size-4" />} label="Rooms occupied" value={`${data.lease.occupiedCount || 0}/${data.lease.roomsCount || 0}`} />
          <Widget icon={<Home className="size-4" />} label="My room" value={data.lease.myRoom || "—"} sub={data.lease.myRentShare ? `rent share ${money(data.lease.myRentShare, symbol)}` : ""} />
          <Widget icon={<KeyRound className="size-4" />} label="My deposit" value={data.lease.myDepositStatus || "—"} />
          <Widget icon={<Users className="size-4" />} label="Move-outs (30d)" value={String(data.lease.upcomingMoveOuts || 0)} tone={(data.lease.upcomingMoveOuts || 0) > 0 ? "text-amber-600" : ""} />
          <Widget icon={<KeyRound className="size-4" />} label="Refunds due" value={String(data.lease.refundsDue || 0)} tone={(data.lease.refundsDue || 0) > 0 ? "text-emerald-600" : ""} />
          <Widget icon={<Home className="size-4" />} label="Vacant rooms" value={String(data.lease.vacantCount || 0)} tone={(data.lease.vacantCount || 0) > 0 ? "text-amber-600" : ""} />
          <div className="rounded-2xl border p-3 flex items-center justify-center"><Link href={`${base}/lease`} className="inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"><KeyRound className="size-3.5 mr-1" /> Open Lease</Link></div>
        </div>
      )}

      {/* Chores widgets */}
      {data.chores && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Widget icon={<Home className="size-4" />} label="My chores today" value={String(data.chores.myToday || 0)} />
          <Widget icon={<Home className="size-4" />} label="Household chores today" value={String(data.chores.today || 0)} />
          <Widget icon={<ClipboardCheck className="size-4" />} label="Completed this week" value={String(data.chores.completedThisWeek || 0)} />
          <Widget icon={<AlertTriangle className="size-4" />} label="Overdue chores" value={String(data.chores.overdue || 0)} tone={(data.chores.overdue || 0) > 0 ? "text-red-500" : ""} />
          <Widget icon={<Home className="size-4" />} label="Next responsibility" value={data.chores.next ? data.chores.next.title : "—"} sub={data.chores.next ? `${data.chores.next.status.toLowerCase()}${data.chores.next.isMine ? " · yours" : ""}` : ""} />
          <Widget icon={<Home className="size-4" />} label="Household completion" value={`${data.chores.completionPct || 0}%`} />
          <Widget icon={<ShoppingCart className="size-4" />} label="Groceries shopper" value={data.groceries?.upcomingRun ? data.groceries.upcomingRun.title : "—"} sub={data.groceries?.upcomingRun ? data.groceries.upcomingRun.status.toLowerCase() : ""} />
          <div className="rounded-2xl border p-3 flex items-center justify-center"><Link href={`${base}/chores`} className="inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"><ClipboardCheck className="size-3.5 mr-1" /> Open Chores</Link></div>
        </div>
      )}

      {/* My position */}
      <Card className="rounded-2xl border-brand/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2"><Wallet className="size-4 text-brand" /><h3 className="font-semibold">My household position</h3></div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button render={<Link href={`${base}/contributions`} />} variant="outline" size="sm" className="rounded-xl h-8"><ArrowUpRight className="size-3.5 mr-1" /> Pay rent / export proof</Button>
              <Button render={<Link href={`${base}/expenses`} />} variant="outline" size="sm" className="rounded-xl h-8"><Receipt className="size-3.5 mr-1" /> Expenses</Button>
              <Button render={<Link href={`${base}/settlements`} />} variant="outline" size="sm" className="rounded-xl h-8"><Scale className="size-3.5 mr-1" /> Settlements</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 mt-4 gap-3">
            <Mini label="Amount due" value={money(data.my.amountDue, symbol)} />
            <Mini label="Amount paid" value={money(data.my.amountPaid, symbol)} />
            <Mini label="My balance" value={money(data.my.balance, symbol)} tone={data.my.balance >= 0 ? "text-emerald-600" : "text-red-500"} />
            <Mini label="Status" value={data.my.status} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">You owe {money(data.my.amountDue, symbol)} (rent share {money(data.my.shareTarget, symbol)} + your expense share {money(data.my.expenseShare, symbol)}) and have paid {money(data.my.amountPaid, symbol)}.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="size-4" /> Upcoming bills</CardTitle></CardHeader>
          <CardContent>
            {data.upcomingBills.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No recurring bills set.</p> : (
              <div className="space-y-1.5">
                {data.upcomingBills.map((b) => <div key={b.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2"><span className="min-w-0 truncate">{b.name}</span><span className="flex items-center gap-3 shrink-0 text-xs"><span className="font-medium">{money(b.amount, symbol)}</span>{b.dueDate ? <span className="text-muted-foreground">{formatDate(b.dueDate)}</span> : <span>—</span>}</span></div>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4" /> Recent household expenses</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.expenses.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No expenses yet.</p> : data.expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                <span className="min-w-0 truncate">{e.title}</span>
                <span className="flex items-center gap-2 shrink-0 text-xs"><Badge variant="outline" className="text-[9px]">{e.category.replace(/_/g, " ")}</Badge><span className="font-medium">{money(e.amount, symbol)}</span>{e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-brand underline">receipt</a>}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4" /> Bills & utilities</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.billsSummary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniIt label="Bills due this week" value={String(data.billsSummary.dueThisWeekCount || 0)} tone={(data.billsSummary.dueThisWeekCount || 0) > 0 ? "text-amber-600" : ""} />
                <MiniIt label="Utilities (bill)" value={money(data.billsSummary.utilitiesThisMonth || 0, symbol)} />
                <MiniIt label="Paid vs outstanding" value={`${money(data.billsSummary.paidTotal || 0, symbol)} / ${money(data.billsSummary.outstandingTotal || 0, symbol)}`} tone={(data.billsSummary.outstandingTotal || 0) > 0 ? "text-amber-600" : "text-emerald-600"} />
                <MiniIt label="Overdue bills" value={String(data.billsSummary.overdueCount || 0)} tone={(data.billsSummary.overdueCount || 0) > 0 ? "text-red-500" : ""} />
              </div>
              {canManage && <div className="flex gap-2 flex-wrap"><Button size="sm" className="rounded-xl h-8" onClick={() => setShowCreateBill(true)}><Plus className="size-3.5 mr-1" /> Create bill</Button><Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => generateCycle(circleId, refresh)}><RefreshCcw className="size-3.5 mr-1" /> Generate cycle</Button></div>}
              {(data.billsSummary.bills || []).length === 0 ? <p className="text-sm text-muted-foreground py-2 text-center">No bills yet this month. Create a recurring bill to get started.</p> : (
                <div className="space-y-1.5">
                  {(data.billsSummary.bills || []).map((b: BillInstance) => (
                    <div key={b.id} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0"><p className="font-medium truncate">{b.name}</p><div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground"><Badge variant="outline" className="text-[9px]">{b.category.replace(/_/g, " ")}</Badge>{b.dueDate ? `Due ${new Date(b.dueDate).toDateString()}` : ""}</div></div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap"><Badge variant="outline" className={`text-[10px] ${BILL_COLORS[b.status] || ""}`}>{b.status.replace(/_/g, " ")}</Badge><span className="font-semibold">{money(b.outstanding, symbol)} / {money(b.expected, symbol)}</span></div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[10px] text-muted-foreground">
                        <span>Your share {money(b.myShare, symbol)} · paid {money(b.myPaid, symbol)}</span>
                        {b.myOutstanding > 0 && <span className="text-amber-600 font-medium">{money(b.myOutstanding, symbol)} outstanding</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        {b.myOutstanding > 0 && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => { setPayingBill(b) }}><Scale className="size-3.5 mr-1" /> Pay my share</Button>}
                        {canManage && <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={() => { setActualBill(b) }}>Record actual</Button>}
                        {b.billFileUrl && <a href={b.billFileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline">bill file</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2 text-center">Set up the household to manage bills.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="size-4" /> Outstanding settlements</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.balances?.allBalances?.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">All balances settled.</p> : (data.balances?.allBalances || []).map((b: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2"><span className="min-w-0 truncate">{(b.debtor?.name || b.debtorId)} owes {(b.creditor?.name || b.creditorId)}</span><span className="font-semibold shrink-0">{money(b.amount, symbol)}</span></div>
          ))}
        </CardContent>
      </Card>

      <SetupDialog open={showSetup} onOpenChange={setShowSetup} circleId={circleId} currency={currency} config={data.config} onSaved={refresh} />
      <CreateBillDialog open={showCreateBill} onOpenChange={setShowCreateBill} circleId={circleId} members={[]} onSaved={refresh} />
      <PayBillDialog bill={payingBill} circleId={circleId} symbol={symbol} onClose={() => setPayingBill(null)} onSaved={() => { refresh(); setPayingBill(null) }} />
      <ActualBillDialog bill={actualBill} circleId={circleId} symbol={symbol} onClose={() => setActualBill(null)} onSaved={() => { refresh(); setActualBill(null) }} />
    </div>
  )
}

function MiniIt({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border p-3 min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className={`text-sm font-bold mt-0.5 truncate ${tone}`}>{value}</p></div>
}

async function generateCycle(circleId: string, refresh: () => void) {
  await fetch(`/api/circles/${circleId}/household/bills?action=generate`, { method: "POST" }).catch(() => {})
  toast.success("Bill cycle generated")
  refresh()
}

function Widget({ icon, label, value, sub, tone = "" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{value}</p>{sub && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>}</CardContent></Card>
}
function Mini({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${tone}`}>{value}</p></div>
}
function HouseholdSkeleton() {
  return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}</div><Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</CardContent></Card></div>
}

function SetupDialog({ open, onOpenChange, circleId, currency, config, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; currency: string; config: any | null; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{config ? "Configure household" : "Set up household"}</DialogTitle><DialogDescription>Rent, address, bills and contacts — everyone sees the shared home finances.</DialogDescription></DialogHeader>
        {open && <SetupForm key={String(open)} circleId={circleId} currency={currency} config={config} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function SetupForm({ circleId, currency, config, onOpenChange, onSaved }: { circleId: string; currency: string; config: any | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({
    name: config?.name || "", address: config?.address || "", leaseStart: config?.leaseStart ? config.leaseStart.slice(0, 10) : "", leaseEnd: config?.leaseEnd ? config.leaseEnd.slice(0, 10) : "",
    monthlyRent: config?.monthlyRent ? String(config.monthlyRent) : "", rentDueDay: config?.rentDueDay ? String(config.rentDueDay) : "1", deposit: config?.deposit ? String(config.deposit) : "",
    currency: config?.currency || currency || "ZAR", rooms: config?.rooms ? String(config.rooms) : "1", utilityCategories: (config?.utilityCategories || []).join(", "),
    rules: config?.rules || "", emergencyContact: config?.emergencyContact || "", landlordContact: config?.landlordContact || "",
  })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!f.name?.trim()) return toast.error("Household name is required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: f.name, address: f.address || null, leaseStart: f.leaseStart || null, leaseEnd: f.leaseEnd || null,
        monthlyRent: f.monthlyRent ? Number(f.monthlyRent) : null, rentDueDay: Number(f.rentDueDay) || null, deposit: f.deposit ? Number(f.deposit) : null,
        currency: f.currency || "ZAR", rooms: Number(f.rooms) || 1, utilityCategories: f.utilityCategories || null,
        rules: f.rules || null, emergencyContact: f.emergencyContact || null, landlordContact: f.landlordContact || null,
      }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Household saved"); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Household name"><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Address"><Input value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Lease start"><Input type="date" value={f.leaseStart || ""} onChange={(e) => setF({ ...f, leaseStart: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Lease end"><Input type="date" value={f.leaseEnd || ""} onChange={(e) => setF({ ...f, leaseEnd: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Monthly rent"><Input type="number" value={f.monthlyRent || ""} onChange={(e) => setF({ ...f, monthlyRent: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Rent due day"><Select value={String(f.rentDueDay || "1")} onValueChange={(v) => setF({ ...f, rentDueDay: v || "1" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 28 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Day {i + 1}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Deposit"><Input type="number" value={f.deposit || ""} onChange={(e) => setF({ ...f, deposit: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Currency"><Select value={f.currency || "ZAR"} onValueChange={(v) => setF({ ...f, currency: v || "ZAR" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Rooms"><Select value={String(f.rooms || "1")} onValueChange={(v) => setF({ ...f, rooms: v || "1" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 8 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Utility categories"><Input value={f.utilityCategories || ""} onChange={(e) => setF({ ...f, utilityCategories: e.target.value })} className="rounded-xl" placeholder="Electricity, Water, Internet" /></Field>
      </div>
      <Field label="Household rules / notes"><Textarea value={f.rules || ""} onChange={(e) => setF({ ...f, rules: e.target.value })} className="rounded-xl" rows={2} /></Field>
      <Field label="Emergency contact"><Input value={f.emergencyContact || ""} onChange={(e) => setF({ ...f, emergencyContact: e.target.value })} className="rounded-xl" /></Field>
      <Field label="Landlord contact"><Input value={f.landlordContact || ""} onChange={(e) => setF({ ...f, landlordContact: e.target.value })} className="rounded-xl" /></Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save household"}</Button>
      </DialogFooter>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}

function CreateBillDialog({ open, onOpenChange, circleId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Array<{ userId: string; name: string }>; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create recurring bill</DialogTitle><DialogDescription>Monthly instances are generated automatically.</DialogDescription></DialogHeader>
        {open && <CreateBillForm key={String(open)} circleId={circleId} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function CreateBillForm({ circleId, onOpenChange, onSaved }: { circleId: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ name: "", category: "ELECTRICITY", expectedAmount: "", dueDay: "1", splitType: "EQUAL" })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!f.name?.trim() || !Number(f.expectedAmount)) return toast.error("Name and expected amount are required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/bills`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, category: f.category, expectedAmount: Number(f.expectedAmount), dueDay: Number(f.dueDay), splitType: f.splitType }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Recurring bill created"); setF({}); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Category"><Select value={f.category || "ELECTRICITY"} onValueChange={(v) => setF({ ...f, category: v || "ELECTRICITY" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["RENT", "ELECTRICITY", "WATER", "INTERNET", "GAS", "CLEANING", "SECURITY", "STREAMING", "LEVY", "CUSTOM"].map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Expected amount"><Input type="number" value={f.expectedAmount || ""} onChange={(e) => setF({ ...f, expectedAmount: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Due day (1-28)"><Select value={String(f.dueDay || "1")} onValueChange={(v) => setF({ ...f, dueDay: v || "1" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 28 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Day {i + 1}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Split method"><Select value={f.splitType || "EQUAL"} onValueChange={(v) => setF({ ...f, splitType: v || "EQUAL" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EQUAL">Equal</SelectItem><SelectItem value="EXACT">Exact</SelectItem><SelectItem value="PERCENTAGE">Percentage</SelectItem></SelectContent></Select></Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Creating..." : "Create"}</Button>
      </DialogFooter>
    </div>
  )
}

function PayBillDialog({ bill, circleId, symbol, onClose, onSaved }: { bill: BillInstance | null; circleId: string; symbol: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState<string>(bill?.myOutstanding ? String(bill.myOutstanding) : "")
  const [reference, setReference] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!bill || !Number(amount) || Number(amount) <= 0) return toast.error("Enter an amount")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("amount", String(Number(amount)))
      if (reference.trim()) fd.append("reference", reference.trim())
      if (file) fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/household/bills/${bill.id}/pay`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Payment recorded"); setAmount(""); setFile(null); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!bill} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Pay bill: {bill?.name}</DialogTitle><DialogDescription>Your share {bill ? money(bill.myShare, symbol) : ""} · paid {bill ? money(bill.myPaid, symbol) : ""} · outstanding {bill ? money(bill.myOutstanding, symbol) : ""}.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label={`Amount (${symbol})`}><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl text-lg font-semibold" /></Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-xl" /></Field>
          <Field label="Proof (optional)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><ArrowUpRight className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Upload proof"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Paying..." : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ActualBillDialog({ bill, circleId, symbol, onClose, onSaved }: { bill: BillInstance | null; circleId: string; symbol: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState<string>(bill?.expected ? String(bill.expected) : "")
  const [meter, setMeter] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!bill || !Number(amount) || Number(amount) < 0) return toast.error("Enter the actual amount")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("actualAmount", String(Number(amount)))
      if (meter.trim()) fd.append("meter", meter.trim())
      if (file) fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/household/bills/${bill.id}/actual`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Actual bill recorded"); setAmount(""); setFile(null); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!bill} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record actual bill: {bill?.name}</DialogTitle><DialogDescription>Upload the bill and enter the real amount; participants are notified.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label={`Actual amount (${symbol})`}><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl text-lg font-semibold" /></Field>
          <Field label="Meter / reference"><Input value={meter} onChange={(e) => setMeter(e.target.value)} className="rounded-xl" /></Field>
          <Field label="Bill file (PDF/image)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Upload bill"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save actual"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}