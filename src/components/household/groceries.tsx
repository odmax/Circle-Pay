"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ShoppingCart, ArrowLeft, Plus, Upload, CheckCircle2, XCircle, Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatDate } from "@/components/projects/types"
import { CURRENCIES } from "@/lib/constants"

const CATEGORIES = ["GROCERIES", "CLEANING", "TOILETRIES", "EQUIPMENT", "FURNITURE", "KITCHEN", "SUBSCRIPTION", "CUSTOM"]
const RUN_STATUS_COLORS: Record<string, string> = {
  PLANNED: "border-slate-200 bg-slate-50 text-slate-600",
  SHOPPING: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

function money(n: number, code: string): string {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

type Purchase = { id: string; runId: string | null; title: string; category: string; store: string | null; amount: number; purchaseDate: string; paidByName: string | null; splitType: string; notes: string | null; receiptUrl: string | null; isMine: boolean; myShare: number }
type Run = { id: string; title: string; status: string; assignedShopperId: string | null; expectedBudget: number | null; actualSpend: number | null; scheduledFor: string | null; notes: string | null; items: Array<{ id: string; name: string; quantity: number; unit: string | null; category: string | null; priority: number; purchased: boolean; note: string | null; addedByName: string | null; canModify: boolean }>; purchasedCount: number; totalItems: number }

export function Groceries({ circleId, circleName, currency }: {
  circleId: string
  circleName: string
  currency: string
}) {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showPurchase, setShowPurchase] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const symbol = currency || "ZAR"

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [g, m] = await Promise.all([
          fetch(`/api/circles/${circleId}/household/groceries`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/circles/${circleId}/members`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        ])
        if (!cancelled && g) {
          setPurchases(g.purchases || [])
          setRuns(g.runs || [])
          const mlist = Array.isArray(m) ? m : m.members || []
          setMembers(mlist.filter((x: any) => x.userId || x.id).map((x: any) => ({ userId: x.userId || x.id, name: x.name || x.user?.name || x.userId })))
        }
      } catch { /* keep */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }
  const base = `/circles/${circleId}`

  const toggleItem = async (runId: string, itemId: string, purchased: boolean) => {
    const r = await fetch(`/api/circles/${circleId}/household/groceries/runs/${runId}?action=update-item`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, purchased }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Item updated"); refresh()
  }
  const setRunStatus = async (runId: string, status: string) => {
    const r = await fetch(`/api/circles/${circleId}/household/groceries/runs/${runId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Run updated"); refresh()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Card className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-24 w-full rounded-xl" /></CardContent></Card></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`${base}/household`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Groceries & Shared Purchases</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} — shared spending, shopping runs and who owes whom</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" className="rounded-xl h-8" onClick={() => setShowRun(true)}><ShoppingCart className="size-3.5 mr-1" /> Grocery run</Button>
          <Button className="rounded-xl h-8 bg-brand hover:bg-brand-600" onClick={() => setShowPurchase(true)}><Plus className="size-3.5 mr-1" /> Add purchase</Button>
        </div>
      </div>

      {/* Purchases */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4" /> Shared purchases</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {purchases.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No shared purchases yet. Add groceries, cleaning supplies and more.</p> : purchases.map((p) => (
            <div key={p.id} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium truncate">{p.title}</span><span className="font-semibold shrink-0">{money(p.amount, symbol)}</span></div>
              <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mt-1">
                <Badge variant="outline" className="text-[9px]">{p.category.replace(/_/g, " ")}</Badge>
                <span>paid by {p.paidByName || "—"}</span>
                <span>{p.splitType.replace(/_/g, " ")}</span>
                {p.store && <span>· {p.store}</span>}
                {p.myShare > 0 && <span className="text-brand-700 font-medium">your share {money(p.myShare, symbol)}</span>}
                {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-brand underline">receipt</a>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Grocery runs */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Grocery runs</h2>
        {runs.length === 0 ? <Card className="rounded-2xl"><CardContent className="py-10 text-center"><ShoppingCart className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No grocery runs yet</p></CardContent></Card> : runs.map((r) => (
          <Card key={r.id} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{r.title}</h3>
                    <Badge variant="outline" className={`text-[10px] ${RUN_STATUS_COLORS[r.status] || ""}`}>{r.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span>{r.purchasedCount}/{r.totalItems} items bought</span>
                    {r.expectedBudget != null && <span>Budget {money(r.expectedBudget, symbol)}</span>}
                    {r.actualSpend != null && <span className="text-brand-700">Spent {money(r.actualSpend, symbol)}</span>}
                    {r.scheduledFor && <span>· {formatDate(r.scheduledFor)}</span>}
                  </div>
                </div>
                {r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
                  <div className="flex items-center gap-1 shrink-0">
                    {r.status === "PLANNED" && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => setRunStatus(r.id, "SHOPPING")}><ShoppingCart className="size-3 mr-1" /> Start shopping</Button>}
                    <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs text-emerald-600" onClick={() => setRunStatus(r.id, "COMPLETED")}><CheckCircle2 className="size-3 mr-1" /> Complete</Button>
                    {r.status !== "CANCELLED" && <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs text-red-500" onClick={() => setRunStatus(r.id, "CANCELLED")}><XCircle className="size-3 mr-1" /></Button>}
                  </div>
                )}
              </div>

              {/* Shopping list */}
              <div className="mt-3 space-y-1.5">
                {(r.items || []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border px-3 py-1.5">
                    <span className={`min-w-0 truncate ${i.purchased ? "line-through text-muted-foreground" : ""}`}>{i.name}{i.quantity > 1 ? ` ×${i.quantity}` : ""}{i.note ? ` — ${i.note}` : ""}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{i.addedByName || "member"}</span>
                      {!i.purchased && <Button size="sm" variant="ghost" className="rounded-xl h-6 text-[10px]" onClick={() => toggleItem(r.id, i.id, true)}><CheckCircle2 className="size-3" /></Button>}
                    </div>
                  </div>
                ))}
                {r.items.length === 0 && <p className="text-xs text-muted-foreground pl-1">No items yet — members can add items below.</p>}
                <AddItemInput circleId={circleId} runId={r.id} onAdded={refresh} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddPurchaseDialog open={showPurchase} onOpenChange={setShowPurchase} circleId={circleId} members={members} symbol={symbol} onSaved={refresh} />
      <AddRunDialog open={showRun} onOpenChange={setShowRun} circleId={circleId} members={members} onSaved={refresh} />
    </div>
  )
}

function AddItemInput({ circleId, runId, onAdded }: { circleId: string; runId: string; onAdded: () => void }) {
  const [name, setName] = useState("")
  const add = async () => {
    if (!name.trim()) return
    const r = await fetch(`/api/circles/${circleId}/household/groceries/runs/${runId}?action=add-item`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Item added to list"); setName(""); onAdded()
  }
  return (
    <div className="flex items-center gap-2 mt-1">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add item to the list..." className="rounded-xl h-8 text-sm" />
      <Button size="sm" className="rounded-xl h-8" onClick={add}><Plus className="size-3.5" /></Button>
    </div>
  )
}

function AddPurchaseDialog({ open, onOpenChange, circleId, members, symbol, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Array<{ userId: string; name: string }>; symbol: string; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add shared purchase</DialogTitle><DialogDescription>Recorded in the shared ledger with your chosen split.</DialogDescription></DialogHeader>
        {open && <AddPurchaseForm key={String(open)} circleId={circleId} members={members} symbol={symbol} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function AddPurchaseForm({ circleId, members, symbol, onOpenChange, onSaved }: { circleId: string; members: Array<{ userId: string; name: string }>; symbol: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ title: "", amount: "", category: "GROCERIES", splitType: "EQUAL", store: "", paidById: "" })
  const [participants, setParticipants] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!f.title?.trim() || !Number(f.amount) || Number(f.amount) <= 0) return toast.error("Title and amount required")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("title", f.title); fd.append("amount", String(Number(f.amount))); fd.append("category", f.category || "GROCERIES"); fd.append("splitType", f.splitType || "EQUAL")
      if (f.paidById) fd.append("paidById", f.paidById)
      if (f.store) fd.append("store", f.store)
      if (f.notes) fd.append("notes", f.notes)
      if (participants.length) fd.append("participantIds", JSON.stringify(participants))
      if (file) fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/household/groceries/purchases`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Purchase recorded"); setF({}); setParticipants([]); setFile(null); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><Input value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-xl" /></Field>
        <Field label={`Amount (${symbol})`}><Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Category"><Select value={f.category || "GROCERIES"} onValueChange={(v) => setF({ ...f, category: v || "GROCERIES" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Split"><Select value={f.splitType || "EQUAL"} onValueChange={(v) => setF({ ...f, splitType: v || "EQUAL" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EQUAL">Equal</SelectItem><SelectItem value="EXACT">Exact</SelectItem><SelectItem value="PERCENTAGE">Percentage</SelectItem></SelectContent></Select></Field>
        <Field label="Store / vendor"><Input value={f.store || ""} onChange={(e) => setF({ ...f, store: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Who paid"><Select value={f.paidById || ""} onValueChange={(v) => setF({ ...f, paidById: v || "" })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="You" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Receipt (optional)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Upload receipt"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
      </div>
      <Field label="Participants"><div className="rounded-xl border p-2 max-h-28 overflow-y-auto grid grid-cols-2 gap-1">{members.length === 0 && <p className="col-span-2 text-xs text-muted-foreground p-1">No members listed.</p>}{members.map((m) => (<label key={m.userId} className="flex items-center gap-1.5 text-xs py-0.5"><input type="checkbox" checked={participants.includes(m.userId)} onChange={(e) => setParticipants(e.target.checked ? [...participants, m.userId] : participants.filter((x) => x !== m.userId))} /> {m.name}</label>))}</div></Field>
      <Field label="Notes"><Input value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} className="rounded-xl" /></Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Recording..." : "Add purchase"}</Button>
      </DialogFooter>
    </div>
  )
}

function AddRunDialog({ open, onOpenChange, circleId, members, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Array<{ userId: string; name: string }>; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New grocery run</DialogTitle><DialogDescription>Members can add items; the shopper checks them off.</DialogDescription></DialogHeader>
        {open && <AddRunForm key={String(open)} circleId={circleId} members={members} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function AddRunForm({ circleId, members, onOpenChange, onSaved }: { circleId: string; members: Array<{ userId: string; name: string }>; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("")
  const [shopper, setShopper] = useState("")
  const [budget, setBudget] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/groceries/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: name || undefined, assignedShopperId: shopper || undefined, expectedBudget: budget ? Number(budget) : undefined }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Grocery run created"); setName(""); setShopper(""); setBudget(""); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2">
      <Field label="Run name"><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" placeholder="e.g. Weekly groceries" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Assigned shopper"><Select value={shopper} onValueChange={(v) => setShopper(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Expected budget"><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-xl" /></Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">Create run</Button>
      </DialogFooter>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}