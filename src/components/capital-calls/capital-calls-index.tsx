"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Megaphone, Plus, ArrowUpRight, Wallet, Upload, Clock, BadgeCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/components/projects/types"

interface CapitalCallItem {
  id: string
  title: string
  purpose: string | null
  amountRequired: number
  allocationMethod: string
  minimumContribution: number | null
  status: string
  dueDate: string | null
  issuedAt: string | null
  opportunityId: string | null
  projectId: string | null
  targetName: string | null
  totals: { requested: number; committed: number; paid: number; outstanding: number }
  my: { requested: number | null; committed: number; paid: number; outstanding: number; dueDate: string | null }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600",
  COMPLETED: "border-brand-200 bg-brand-50 text-brand-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

export function CapitalCallsIndex({ circleId, circleName, currency, canCreate, canManage }: {
  circleId: string
  circleName: string
  currency: string
  canCreate: boolean
  canManage: boolean
}) {
  const symbol = currency || "ZAR"
  const [calls, setCalls] = useState<CapitalCallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/capital-calls`)
        if (!r.ok) throw new Error("Failed to load capital calls")
        const data = await r.json()
        if (!cancelled) { setCalls(data.calls || []); setError(null) }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1) }

  const open = calls.filter((c) => c.status === "OPEN")
  const draft = calls.filter((c) => c.status === "DRAFT")
  const myOutstandingOpen = open.filter((c) => c.my.outstanding > 0)

  const runAction = async (callId: string, action: string) => {
    const r = await fetch(`/api/circles/${circleId}/capital-calls/${callId}?action=${action}`, { method: "POST" })
    if (!r.ok) { const j = await r.json().catch(() => ({})); toast.error(j.error || "Action failed"); return }
    toast.success("Done")
    refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capital Calls</h1>
          <p className="text-muted-foreground">{circleName} — request member capital for projects or opportunities with due dates and proof tracking</p>
        </div>
        {canCreate && <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> New Capital Call</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open Calls" value={String(open.length)} icon={<Wallet className="size-4" />} />
        <Stat label="Capital Being Requested" value={formatCurrency(open.reduce((s, c) => s + c.amountRequired, 0), symbol)} icon={<Megaphone className="size-4" />} />
        <Stat label="My Outstanding" value={formatCurrency(myOutstandingOpen.reduce((s, c) => s + c.my.outstanding, 0), symbol)} icon={<Clock className="size-4" />} color={myOutstandingOpen.length > 0 ? "text-amber-600" : ""} />
      </div>

      {loading ? <IndexSkeleton /> : error ? <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-red-500">{error}</p><Button variant="outline" className="rounded-xl mt-3" onClick={refresh}>Retry</Button></CardContent></Card> : calls.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-14 text-center"><Megaphone className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No capital calls yet</p><p className="text-sm text-muted-foreground mt-1">Issue a capital call to request funds from members for a project or opportunity.</p>{canCreate && <Button className="rounded-xl mt-4 bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> Create one</Button>}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {calls.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/circles/${circleId}/capital-calls/${c.id}`} className="font-semibold hover:text-brand transition-colors truncate">{c.title}</Link>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status] || ""}`}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>{c.targetName ? `For: ${c.targetName}` : "General call"}</span>
                      <span>Requested {formatCurrency(c.amountRequired, symbol)}</span>
                      <span className="text-muted-foreground">Paid {formatCurrency(c.totals.paid, symbol)}</span>
                      <span className="text-amber-600">Outstanding {formatCurrency(c.totals.outstanding, symbol)}</span>
                      {c.dueDate && <span className="flex items-center gap-1"><Clock className="size-3" /> Due {formatDate(c.dueDate)}</span>}
                    </div>
                    {c.my.committed > 0 || c.my.paid > 0 ? (
                      <p className="text-[10px] text-brand-700 bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1 mt-2 inline-block">
                        You: committed {formatCurrency(c.my.committed, symbol)} · paid {formatCurrency(c.my.paid, symbol)} · outstanding {formatCurrency(c.my.outstanding, symbol)}
                      </p>
                    ) : c.my.requested != null ? (
                      <p className="text-[10px] text-muted-foreground mt-2">Your requested share: {formatCurrency(c.my.requested, symbol)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button render={<Link href={`/circles/${circleId}/capital-calls/${c.id}`} />} variant="outline" size="sm" className="rounded-xl h-8"><ArrowUpRight className="size-3.5 mr-1" /> View</Button>
                    {c.status === "OPEN" && <Button size="sm" className="rounded-xl h-8 bg-brand hover:bg-brand-600" onClick={() => setPayingId(c.id)}><Upload className="size-3.5 mr-1" /> Pay</Button>}
                    {c.status === "DRAFT" && canManage && <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => runAction(c.id, "issue")}><BadgeCheck className="size-3.5 mr-1" /> Issue</Button>}
                    {c.status === "OPEN" && canManage && <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => runAction(c.id, "close")}>Close</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {draft.length > 0 && canManage && (
        <p className="text-xs text-muted-foreground">{draft.length} draft call(s) ready to issue — issuing allocates requested amounts to members evenly.</p>
      )}

      <CreateCallDialog open={showCreate} onOpenChange={setShowCreate} circleId={circleId} symbol={symbol} onCreated={refresh} />
      <PayDialog payingId={payingId} circleId={circleId} symbol={symbol} onClose={() => setPayingId(null)} onDone={() => { refresh(); setPayingId(null) }} />
    </div>
  )
}

function Stat({ label, value, icon, color = "" }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-base sm:text-lg font-bold truncate ${color}`}>{value}</p></CardContent></Card>
}

function IndexSkeleton() {
  return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /></CardContent></Card>)}</div>
}

interface CreateCallForm {
  title: string
  purpose: string
  amountRequired: string
  allocationMethod: string
  minimumContribution: string
  dueDate: string
}

interface OpportunityTarget {
  id: string
  title: string
  status: string
}

interface ProjectTarget {
  id: string
  name: string
  status: string
}

function CreateCallDialog({ open, onOpenChange, circleId, symbol, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; symbol: string; onCreated: () => void }) {
  const [form, setForm] = useState<CreateCallForm>({ title: "", purpose: "", amountRequired: "", allocationMethod: "EQUAL", minimumContribution: "", dueDate: "" })
  const [targets, setTargets] = useState<Array<{ id: string; title: string; kind: "opportunity" | "project" }>>([])
  const [selectedTarget, setSelectedTarget] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const [o, p] = await Promise.all([
        fetch(`/api/circles/${circleId}/opportunities`).then((r) => (r.ok ? r.json() : { opportunities: [] as OpportunityTarget[] })).catch(() => ({ opportunities: [] as OpportunityTarget[] })),
        fetch(`/api/circles/${circleId}/projects`).then((r) => (r.ok ? r.json() : [] as ProjectTarget[])).catch(() => [] as ProjectTarget[]),
      ])
      const list: Array<{ id: string; title: string; kind: "opportunity" | "project" }> = [
        ...((o.opportunities || [] as OpportunityTarget[])).filter((x: OpportunityTarget) => x.status === "OPEN").map((x: OpportunityTarget) => ({ id: x.id, title: `${x.title} (opportunity)`, kind: "opportunity" as const })),
        ...((p as ProjectTarget[])).filter((x: ProjectTarget) => ["ACTIVE", "REVENUE_GENERATING", "FULLY_FUNDED"].includes(x.status)).map((x: ProjectTarget) => ({ id: x.id, title: `${x.name} (project)`, kind: "project" as const })),
      ]
      setTargets(list)
    })()
  }, [open, circleId])

  const submit = async () => {
    if (!form.title.trim() || !form.amountRequired) return toast.error("Title and amount required")
    setSubmitting(true)
    try {
      const target = targets.find((t) => t.id === selectedTarget)
      const r = await fetch(`/api/circles/${circleId}/capital-calls`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, purpose: form.purpose || undefined,
          amountRequired: Number(form.amountRequired),
          allocationMethod: form.allocationMethod || "EQUAL",
          minimumContribution: form.minimumContribution ? Number(form.minimumContribution) : undefined,
          dueDate: form.dueDate || null,
          opportunityId: target?.kind === "opportunity" ? target.id : null,
          projectId: target?.kind === "project" ? target.id : null,
        }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Capital call created as draft")
      onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Capital Call</DialogTitle><DialogDescription>Create as a draft, then issue it to allocate requested amounts to members.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" placeholder="e.g. Q3 contribution" /></Field>
          <Field label="Purpose"><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="rounded-xl" rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount required (${symbol})`}><Input type="number" value={form.amountRequired} onChange={(e) => setForm({ ...form, amountRequired: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Allocation method"><Select value={form.allocationMethod} onValueChange={(v) => setForm({ ...form, allocationMethod: v || "EQUAL" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EQUAL">Equal</SelectItem><SelectItem value="OPEN">Open (any amount)</SelectItem><SelectItem value="CUSTOM">Custom</SelectItem></SelectContent></Select></Field>
            <Field label="Minimum contribution"><Input type="number" value={form.minimumContribution} onChange={(e) => setForm({ ...form, minimumContribution: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded-xl" /></Field>
          </div>
          <Field label="Link to (optional)"><Select value={selectedTarget} onValueChange={(v) => setSelectedTarget(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="No link" /></SelectTrigger><SelectContent>{targets.map((t) => <SelectItem key={`${t.kind}-${t.id}`} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select><p className="text-[10px] text-muted-foreground">Payments flow into the linked project/opportunity and reuse their proof & approval flows.</p></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Creating..." : "Create draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayDialog({ payingId, circleId, symbol, onClose, onDone }: { payingId: string | null; circleId: string; symbol: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!payingId || !Number(amount) || Number(amount) <= 0) return toast.error("Enter an amount")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/capital-calls/${payingId}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), reference: reference || undefined }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Paid. The underlying contribution/commitment now needs proof uploaded before it is confirmed.")
      setAmount(""); setReference(""); onDone()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!payingId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Pay capital call</DialogTitle><DialogDescription>Your payment creates a pending contribution/commitment. Upload proof next so management can confirm it.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label={`Amount (${symbol})`}><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl text-lg font-semibold" /></Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-xl" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Paying..." : "Pay"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
}