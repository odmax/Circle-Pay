"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Megaphone, Clock, Upload, BadgeCheck, CheckCircle2, Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/components/projects/types"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600",
  COMPLETED: "border-brand-200 bg-brand-50 text-brand-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

interface CallInfo {
  id: string
  title: string
  purpose: string | null
  amountRequired: number
  allocationMethod: string
  minimumContribution: number | null
  status: string
  issuedAt: string | null
  dueDate: string | null
  opportunityId: string | null
  projectId: string | null
  targetName: string | null
}

interface AllocationInfo {
  userId: string
  name: string
  requestedAmount: number | null
  paid: number
}

interface EntryInfo {
  userId: string
  amount: number
  status: string
}

interface CallDetailData {
  call: CallInfo
  allocations: AllocationInfo[]
  my: { requestedAmount: number | null; paid: number }
  entries: EntryInfo[]
}

export function CapitalCallDetail({ circleId, circleName, currency, callId, canManage }: {
  circleId: string
  circleName: string
  currency: string
  callId: string
  canManage: boolean
}) {
  const symbol = currency || "ZAR"
  const [data, setData] = useState<CallDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [payOpen, setPayOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/capital-calls/${callId}`)
        if (!r.ok) throw new Error("Failed to load")
        const json = await r.json()
        if (!cancelled) { setData(json); setError(null) }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, callId, reloadKey])

  const refresh = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1) }

  const runAction = async (action: string) => {
    const r = await fetch(`/api/circles/${circleId}/capital-calls/${callId}?action=${action}`, { method: "POST" })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Done"); refresh()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Card className="rounded-2xl"><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-12 w-full" /></CardContent></Card></div>
  if (error || !data) return <Card className="rounded-2xl"><CardContent className="py-14 text-center"><p className="text-red-500">{error || "Not found"}</p><Button variant="outline" className="rounded-xl mt-3" onClick={refresh}>Retry</Button></CardContent></Card>

  const { call, allocations, entries } = data
  const mine = data.my || { requestedAmount: null, paid: 0 }
  const isOpen = call.status === "OPEN"
  const committed = entries.filter((e) => ["PENDING", "PAID", "CONFIRMED"].includes(e.status)).reduce((s, e) => s + e.amount, 0)
  const paid = entries.filter((e) => e.status === "CONFIRMED").reduce((s, e) => s + e.amount, 0)
  const outstanding = Math.max(0, mine.requestedAmount != null ? mine.requestedAmount - mine.paid : 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button render={<Link href={`/circles/${circleId}/capital-calls`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{call.title}</h1>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[call.status] || ""}`}>{call.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{circleName}{call.targetName ? ` · For: ${call.targetName}` : ""}{call.dueDate ? ` · due ${formatDate(call.dueDate)}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOpen && <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setPayOpen(true)}><Upload className="size-4 mr-1" /> Pay</Button>}
          {canManage && call.status === "DRAFT" && <Button variant="outline" className="rounded-xl" onClick={() => runAction("issue")}><BadgeCheck className="size-4 mr-1" /> Issue</Button>}
          {canManage && isOpen && <Button variant="outline" className="rounded-xl" onClick={() => runAction("close")}>Close</Button>}
          {canManage && isOpen && <Button variant="outline" className="rounded-xl" onClick={() => runAction("complete")}>Complete</Button>}
          {canManage && call.status !== "CANCELLED" && call.status !== "COMPLETED" && <Button variant="destructive" className="rounded-xl" onClick={() => runAction("cancel")}>Cancel</Button>}
        </div>
      </div>

      {call.purpose && <p className="text-sm text-muted-foreground">{call.purpose}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requested" value={formatCurrency(call.amountRequired, symbol)} icon={<Megaphone className="size-4" />} />
        <Stat label="Committed" value={formatCurrency(committed, symbol)} />
        <Stat label="Paid (confirmed)" value={formatCurrency(paid, symbol)} />
        <Stat label="Your outstanding" value={formatCurrency(outstanding, symbol)} icon={<Clock className="size-4" />} color={outstanding > 0 ? "text-amber-600" : "text-emerald-600"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Allocations</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {allocations.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No allocations yet — issue the call to allocate evenly, or members pay any amount (open method).</p> : allocations.map((a) => (
              <div key={a.userId} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                <span className="min-w-0 truncate">{a.name}</span>
                <span className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-muted-foreground">Requested {a.requestedAmount != null ? formatCurrency(a.requestedAmount, symbol) : "—"}</span>
                  <span className="text-emerald-600">Paid {formatCurrency(a.paid, symbol)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="size-4" /> Payments</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {entries.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No payments yet.</p> : entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                <span className="text-xs text-muted-foreground">{e.userId.slice(0, 8)}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="font-medium">{formatCurrency(e.amount, symbol)}</span>
                  <Badge variant="outline" className={`text-[10px] ${e.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : e.status === "PENDING" ? "" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{e.status.replace(/_/g, " ")}</Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <PayDialog open={payOpen} onOpenChange={setPayOpen} circleId={circleId} callId={callId} symbol={symbol} onDone={() => { refresh(); setPayOpen(false) }} />
    </div>
  )
}

function Stat({ label, value, icon, color = "" }: { label: string; value: string; icon?: React.ReactNode; color?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1">{icon && <span className="text-muted-foreground">{icon}</span>}<p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-base sm:text-lg font-bold truncate ${color}`}>{value}</p></CardContent></Card>
}

function PayDialog({ open, onOpenChange, circleId, callId, symbol, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; callId: string; symbol: string; onDone: () => void }) {
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!Number(amount) || Number(amount) <= 0) return toast.error("Enter an amount")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/capital-calls/${callId}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), reference: reference || undefined }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Paid — upload proof to the linked project/opportunity to complete confirmation")
      setAmount(""); setReference(""); onDone()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Pay capital call</DialogTitle><DialogDescription>If this call is linked to a project or opportunity, go to it afterwards to upload proof.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-xs">Amount ({symbol})</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl text-lg font-semibold" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-xl" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Paying..." : "Pay"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}