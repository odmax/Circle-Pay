"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Wallet, ArrowLeft, Plus, Upload, TrendingDown, PiggyBank, Scale, Receipt,
  CheckCircle2, XCircle, ArrowUpRight, FileText, BarChart3, BellRing,
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
import { CURRENCIES } from "@/lib/constants"

const CATEGORIES = ["FLIGHTS", "ACCOMMODATION", "TRANSPORT", "FOOD", "ACTIVITIES", "SHOPPING", "VISA_INSURANCE", "EMERGENCY", "OTHER"]

type Member = { userId: string; name: string }
type ExpenseRow = {
  id: string; title: string; amount: number; category: string; splitType: string; expenseDate: string;
  receiptUrl: string | null; travelItemId: string | null; travelItemTitle: string | null; paidByName: string | null;
  splits: Array<{ userId: string; name: string; amount: number }>
}
type BalanceRow = { debtorId: string; creditorId: string; amount: number; debtor: { name: string | null }; creditor: { name: string | null } }
type SettlementRow = { id: string; debtorName: string; creditorName: string; amount: number; note: string | null; proofUrl: string | null; status: string; createdAt: string; confirmedByName: string | null }
type ReconcileRow = { userId: string; name: string; contributions: number; memberPaidExpenses: number; share: number; settledGiven: number; settledReceived: number; finalBalance: number }
type MyRow = ReconcileRow & { totalIOwe: number; totalOwedToMe: number; netBalance: number }
type Financials = {
  budget: { totalBudget: number; totalSpent: number; remaining: number; spendPct: number; budgetRemainingPct: number; topCategory: string | null; overBudgetByCategory: string[]; byCategory: Array<{ category: string; budgeted: number; spent: number; remaining: number }> }
  daily: Array<{ date: string; total: number }>
  perMember: Array<{ userId: string; name: string; share: number }>
  reconciliation: ReconcileRow[]
  my: MyRow | null
  balances: { allBalances: BalanceRow[]; totalIOwe: number; totalOwedToMe: number; netBalance: number }
  settlements: SettlementRow[]
  expenses: ExpenseRow[]
}

function money(n: number, code: string): string {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function TravelBudget({ circleId, circleName, currency, canManage }: {
  circleId: string
  circleName: string
  currency: string
  canManage: boolean
}) {
  const [data, setData] = useState<Financials | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tripItems, setTripItems] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showBudget, setShowBudget] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [showSettle, setShowSettle] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/travel/budget`)
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setData(j)
      } catch { /* keep */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [m, it] = await Promise.all([
          fetch(`/api/circles/${circleId}/members`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetch(`/api/circles/${circleId}/itinerary`).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] as any[] })),
        ])
        const mlist = Array.isArray(m) ? m : m.members || []
        if (!cancelled) {
          setMembers(mlist.filter((x: any) => x.userId || x.id).map((x: any) => ({ userId: x.userId || x.id, name: x.name || x.user?.name || x.userId })))
          setTripItems((it.items || []).map((x: any) => ({ id: x.id, title: x.title })))
        }
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [circleId])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }
  const base = `/circles/${circleId}`
  const symbol = currency || "ZAR"

  const confirmSettlement = async (id: string) => {
    const r = await fetch(`${base}/settlements/${id}/confirm`, { method: "POST" })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Settlement confirmed"); refresh()
  }
  const rejectSettlement = async (id: string) => {
    const r = await fetch(`${base}/settlements/${id}/reject`, { method: "POST" })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Settlement rejected"); refresh()
  }

  if (loading) return <BudgetSkeleton />

  if (!data) {
    return <Card className="rounded-2xl"><CardContent className="py-14 text-center"><Wallet className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">Could not load travel finances</p><Button variant="outline" className="rounded-xl mt-3" onClick={refresh}>Retry</Button></CardContent></Card>
  }

  const b = data.budget

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`${base}/trip`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Budget & Settlements</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} — shared budget, splits and who owes whom</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {canManage && <Button variant="outline" className="rounded-xl h-8" onClick={() => setShowBudget(true)}><BarChart3 className="size-3.5 mr-1" /> Set budgets</Button>}
          <Button className="rounded-xl h-8 bg-brand hover:bg-brand-600" onClick={() => setShowExpense(true)}><Plus className="size-3.5 mr-1" /> Add expense</Button>
          <Button variant="outline" className="rounded-xl h-8" onClick={() => setShowSettle(true)}><Scale className="size-3.5 mr-1" /> Record settlement</Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<TrendingDown className="size-4" />} label="Total spent" value={money(b.totalSpent, symbol)} />
        <Widget icon={<Wallet className="size-4" />} label="Budget remaining" value={money(b.remaining, symbol)} tone={b.remaining < 0 ? "text-red-500" : ""} />
        <Widget icon={<PiggyBank className="size-4" />} label="My paid" value={data.my ? money((data.my.memberPaidExpenses || 0) + (data.my.contributions || 0), symbol) : "—"} />
        <Widget icon={<Scale className="size-4" />} label="My outstanding" value={data.my ? money(Math.max(0, (data.my.share || 0) - (data.my.memberPaidExpenses || 0) - (data.my.contributions || 0)), symbol) : "—"} tone={data.my && (data.my.netBalance || 0) < 0 ? "text-amber-600" : ""} />
      </div>

      {b.overBudgetByCategory.length > 0 && (
        <div className="flex items-center gap-2 text-sm p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-800 flex-wrap">
          <BellRing className="size-4 shrink-0" /> Over budget: {b.overBudgetByCategory.map((c) => c.replace(/_/g, " ")).join(", ")}
        </div>
      )}

      {/* Budget by category */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="size-4" /> Budget by category</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {b.byCategory.filter((c) => c.budgeted > 0 || c.spent > 0).length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No budget or expenses yet. Add an expense or set category budgets.</p> : b.byCategory.map((c) => (c.budgeted > 0 || c.spent > 0) && (
            <div key={c.category}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-medium">{c.category.replace(/_/g, " ")}{c.budgeted > 0 && c.spent > c.budgeted && <span className="text-red-500 ml-1">over</span>}</span>
                <span className="text-muted-foreground">{money(c.spent, symbol)}{c.budgeted > 0 ? ` / ${money(c.budgeted, symbol)}` : ""}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-2 rounded-full ${c.spent > c.budgeted && c.budgeted > 0 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${c.budgeted > 0 ? Math.min(100, Math.round((c.spent / c.budgeted) * 100)) : Math.min(100, c.spent > 0 ? 100 : 0)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expenses */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4" /> Expenses</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.expenses.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No travel expenses yet.</p> : data.expenses.map((e) => (
              <div key={e.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-medium truncate">{e.title}</span><span className="font-semibold shrink-0">{money(e.amount, symbol)}</span></div>
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mt-1">
                  <Badge variant="outline" className="text-[9px]">{e.category.replace(/_/g, " ")}</Badge>
                  <span>paid by {e.paidByName || "—"}</span>
                  <span>{e.splitType.replace(/_/g, " ")}</span>
                  {e.travelItemTitle && <span>· {e.travelItemTitle}</span>}
                  {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-brand underline inline-flex items-center gap-0.5"><FileText className="size-3" /> receipt</a>}
                </div>
              </div>
            ))}
            <Button render={<Link href={`${base}/expenses`} />} variant="ghost" size="sm" className="rounded-xl mt-1 h-7 text-xs"><ArrowUpRight className="size-3.5 mr-1" /> All circle expenses</Button>
          </CardContent>
        </Card>

        {/* Settlements */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="size-4" /> Settlements</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.balances.allBalances.length === 0 && data.settlements.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No outstanding balances.</p> : (
              <>
                {data.balances.allBalances.map((brow) => (
                  <div key={`${brow.debtorId}-${brow.creditorId}`} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                    <span className="min-w-0 truncate">{brow.debtor.name || brow.debtorId} owes {brow.creditor.name || brow.creditorId}</span>
                    <span className="font-semibold shrink-0 ml-3">{money(brow.amount, symbol)}</span>
                  </div>
                ))}
                {data.settlements.map((s) => (
                  <div key={s.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{s.debtorName} → {s.creditorName}</span>
                      <span className="flex items-center gap-2 shrink-0"><span className="font-semibold">{money(s.amount, symbol)}</span><Badge variant="outline" className={`text-[9px] ${s.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : s.status === "REJECTED" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{s.status}</Badge></span>
                    </div>
                    {s.status === "PENDING" && (
                      <div className="flex gap-2 mt-1.5">
                        <Button size="sm" variant="outline" className="rounded-xl h-6 text-[10px] text-emerald-600" onClick={() => confirmSettlement(s.id)}><CheckCircle2 className="size-3 mr-1" /> Confirm</Button>
                        <Button size="sm" variant="outline" className="rounded-xl h-6 text-[10px] text-red-500" onClick={() => rejectSettlement(s.id)}><XCircle className="size-3 mr-1" /> Reject</Button>
                      </div>
                    )}
                    {s.proofUrl && <a href={s.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline inline-flex items-center gap-0.5 mt-1"><FileText className="size-3" /> proof</a>}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Final trip reconciliation</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-[11px] text-muted-foreground border-b">
              <th className="py-1.5 pr-3">Member</th><th className="py-1.5 pr-3">Contributions</th><th className="py-1.5 pr-3">Paid expenses</th><th className="py-1.5 pr-3">Share due</th><th className="py-1.5 pr-3">Settled (net)</th><th className="py-1.5">Final balance</th>
            </tr></thead>
            <tbody>
              {data.reconciliation.map((r) => (
                <tr key={r.userId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.name}</td>
                  <td className="py-2 pr-3">{money(r.contributions, symbol)}</td>
                  <td className="py-2 pr-3">{money(r.memberPaidExpenses, symbol)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{money(r.share, symbol)}</td>
                  <td className="py-2 pr-3">{money(r.settledReceived - r.settledGiven, symbol)}</td>
                  <td className={`py-2 font-semibold ${r.finalBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>{money(r.finalBalance, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground mt-2">Contributions + member-paid expenses − shared expense share − settlements = final balance (positive: member is owed).</p>
        </CardContent>
      </Card>

      <BudgetDialog open={showBudget} onOpenChange={setShowBudget} circleId={circleId} initial={b.byCategory} onSaved={refresh} />
      <ExpenseDialog open={showExpense} onOpenChange={setShowExpense} circleId={circleId} members={members} items={tripItems} symbol={symbol} onSaved={refresh} />
      <SettlementDialog open={showSettle} onOpenChange={setShowSettle} circleId={circleId} members={members} balances={data.balances.allBalances} symbol={symbol} onSaved={refresh} />
    </div>
  )
}

function Widget({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{value}</p></CardContent></Card>
}

function BudgetSkeleton() {
  return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}</div><Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</CardContent></Card></div>
}

function BudgetDialog({ open, onOpenChange, circleId, initial, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; initial: Array<{ category: string; budgeted: number; spent: number }>; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    setSubmitting(true)
    try {
      const budgetByCategory: Record<string, number> = {}
      for (const c of CATEGORIES) budgetByCategory[c] = Number(vals[c] || 0) || 0
      const r = await fetch(`/api/circles/${circleId}/travel/budget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budgetByCategory }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Budgets saved"); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Set category budgets</DialogTitle></DialogHeader>
        {open && <BudgetForm key={String(open)} initial={initial} setVals={setVals} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save budgets"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function BudgetForm({ initial, setVals }: { initial: Array<{ category: string; budgeted: number }>; setVals: (v: Record<string, string>) => void }) {
  const [vals, setLocal] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((c) => [c.category, c.budgeted ? String(c.budgeted) : ""])))
  const update = (v: Record<string, string>) => { setLocal(v); setVals(v) }
  return (
    <div className="space-y-2 py-2 max-h-60 overflow-y-auto pr-1">
      {CATEGORIES.map((c) => (
        <div key={c} className="flex items-center justify-between gap-3">
          <Label className="text-xs">{c.replace(/_/g, " ")}</Label>
          <Input type="number" value={vals[c] || ""} onChange={(e) => update({ ...vals, [c]: e.target.value })} className="rounded-xl w-32 text-right" />
        </div>
      ))}
    </div>
  )
}

function ExpenseDialog({ open, onOpenChange, circleId, members, items, symbol, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Member[]; items: Array<{ id: string; title: string }>; symbol: string; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add travel expense</DialogTitle><DialogDescription>Receipt is stored privately. Splits are shared with participants.</DialogDescription></DialogHeader>
        {open && <ExpenseForm key={String(open)} circleId={circleId} members={members} items={items} symbol={symbol} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function ExpenseForm({ circleId, members, items, symbol, onOpenChange, onSaved }: { circleId: string; members: Member[]; items: Array<{ id: string; title: string }>; symbol: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ title: "", amount: "", category: "FOOD", splitType: "EQUAL", travelItemId: "", paidById: "" })
  const [participants, setParticipants] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!f.title?.trim() || !Number(f.amount) || Number(f.amount) <= 0) return toast.error("Title and a valid amount are required")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("title", f.title)
      fd.append("amount", String(Number(f.amount)))
      fd.append("category", f.category || "FOOD")
      fd.append("splitType", f.splitType || "EQUAL")
      if (f.paidById) fd.append("paidById", f.paidById)
      if (f.travelItemId) fd.append("travelItemId", f.travelItemId)
      if (f.expenseDate) fd.append("expenseDate", new Date(f.expenseDate).toISOString())
      if (participants.length) fd.append("participantIds", JSON.stringify(participants))
      if (file) fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/travel/expenses`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Expense added")
      setF({}); setParticipants([]); setFile(null); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><Input value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-xl" /></Field>
        <Field label={`Amount (${symbol})`}><Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Category"><Select value={f.category || "FOOD"} onValueChange={(v) => setF({ ...f, category: v || "FOOD" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Split"><Select value={f.splitType || "EQUAL"} onValueChange={(v) => setF({ ...f, splitType: v || "EQUAL" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EQUAL">Equal</SelectItem><SelectItem value="EXACT">Exact</SelectItem><SelectItem value="PERCENTAGE">Percentage</SelectItem></SelectContent></Select></Field>
        <Field label="Who paid"><Select value={f.paidById || ""} onValueChange={(v) => setF({ ...f, paidById: v || "" })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="You (default)" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Link to itinerary item"><Select value={f.travelItemId || ""} onValueChange={(v) => setF({ ...f, travelItemId: v || "" })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Date"><Input type="date" value={f.expenseDate || ""} onChange={(e) => setF({ ...f, expenseDate: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Receipt (optional)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Upload receipt"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
      </div>
      <Field label="Participants (equal/exact/percentage share)">
        <div className="rounded-xl border p-2 max-h-28 overflow-y-auto grid grid-cols-2 gap-1">
          {members.length === 0 && <p className="col-span-2 text-xs text-muted-foreground p-1">No members listed.</p>}
          {members.map((m) => (
            <label key={m.userId} className="flex items-center gap-1.5 text-xs py-0.5"><input type="checkbox" checked={participants.includes(m.userId)} onChange={(e) => setParticipants(e.target.checked ? [...participants, m.userId] : participants.filter((x) => x !== m.userId))} /> {m.name}</label>
          ))}
        </div>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Adding..." : "Add expense"}</Button>
      </DialogFooter>
    </div>
  )
}

function SettlementDialog({ open, onOpenChange, circleId, members, balances, symbol, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Member[]; balances: BalanceRow[]; symbol: string; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record settlement</DialogTitle><DialogDescription>Must match an outstanding balance (debtor → creditor).</DialogDescription></DialogHeader>
        {open && <SettlementForm key={String(open)} circleId={circleId} members={members} balances={balances} symbol={symbol} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function SettlementForm({ circleId, members, balances, symbol, onOpenChange, onSaved }: { circleId: string; members: Member[]; balances: BalanceRow[]; symbol: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [debtorId, setDebtorId] = useState("")
  const [creditorId, setCreditorId] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!debtorId || !creditorId || !Number(amount) || Number(amount) <= 0) return toast.error("Debtor, creditor and amount are required")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("debtorId", debtorId)
      fd.append("creditorId", creditorId)
      fd.append("amount", String(Number(amount)))
      if (note.trim()) fd.append("note", note.trim())
      if (file) fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/travel/settlements`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Settlement recorded")
      setDebtorId(""); setCreditorId(""); setAmount(""); setFile(null); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Debtor (who pays)"><Select value={debtorId} onValueChange={(v) => setDebtorId(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Creditor (who is owed)"><Select value={creditorId} onValueChange={(v) => setCreditorId(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label={`Amount (${symbol})`}><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" /></Field>
        <Field label="Proof (optional)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Upload proof"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
      </div>
      <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" rows={2} /></Field>
      {balances.length > 0 && <p className="text-[10px] text-muted-foreground">Outstanding: {balances.map((b) => `${b.debtorId.slice(0, 4)}→${b.creditorId.slice(0, 4)}: ${money(b.amount, symbol)}`).join(" · ")}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Recording..." : "Record settlement"}</Button>
      </DialogFooter>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}