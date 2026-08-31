"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Upload, Wallet, ShieldAlert, Sparkles, BadgeCheck,
  XCircle, CheckCircle2, FileText, Percent, ArrowRight, Coins, Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/components/projects/types"
import { ProgressBar } from "@/components/projects/charts"

interface CommitmentDetail {
  id: string
  userId: string
  amount: number
  status: string
  proofUrl: string | null
  proofReference: string | null
  createdAt: string
  userName: string | null
}

interface OpportunityDetails {
  opportunity: {
    id: string; title: string; description: string | null; type: string; status: string;
    targetAmount: number; raised: number; fundingPercent: number;
    minimumInvestment: number | null; maximumInvestment: number | null;
    expectedReturn: number | null; expectedDuration: string | null; riskLevel: string;
    coverImage: string | null; openDate: string | null; closingDate: string | null;
    requiresApproval: boolean; requiresVote: boolean; investors: number; projectId: string | null;
    createdByName: string | null; myCommitted: number; myConfirmed: number; myPending: number;
  }
  viewerId: string
  documents: Array<{ id: string; name: string; url: string; mimeType: string | null; size: number | null; createdAt: string }>
  commitments: CommitmentDetail[]
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FUNDED: "border-brand-200 bg-brand-50 text-brand-700",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

const COMMITMENT_COLORS: Record<string, string> = {
  PENDING: "border-slate-200 bg-slate-50 text-slate-600",
  PAID: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  WITHDRAWN: "border-slate-200 bg-slate-50 text-slate-500",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-500",
}

export function OpportunityDetail({ circleId, circleName, currency, opportunityId, canManage, canApprove }: {
  circleId: string
  circleName: string
  currency: string
  opportunityId: string
  canManage: boolean
  canApprove: boolean
}) {
  const symbol = currency || "ZAR"
  const [data, setData] = useState<OpportunityDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showCommit, setShowCommit] = useState(false)
  const [provingId, setProvingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/opportunities/${opportunityId}`)
        if (!r.ok) throw new Error("Failed to load opportunity")
        const json = await r.json()
        if (!cancelled) { setData(json); setError(null) }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, opportunityId, reloadKey])

  const refresh = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1) }

  const mine = data ? data.commitments.filter((c) => c.userId === data.viewerId) : []

  const action = async (actionName: string, extra?: Record<string, unknown>) => {
    try {
      const r = await fetch(`/api/circles/${circleId}/opportunities/${opportunityId}?action=${actionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra || {}),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Action failed")
      toast.success("Done")
      refresh()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-72" /><div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-2 w-full" /><Skeleton className="h-8 w-24" /></CardContent></Card>)}</div></div>
  }

  if (error || !data) {
    return <Card className="rounded-2xl"><CardContent className="py-14 text-center"><p className="text-red-500">{error || "Not found"}</p><Button variant="outline" className="rounded-xl mt-3" onClick={refresh}>Retry</Button></CardContent></Card>
  }

  const { opportunity: opp, documents, commitments } = data
  const canSelfCommit = opp.status === "OPEN" && (!opp.closingDate || new Date(opp.closingDate) > new Date())

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button render={<Link href={`/circles/${circleId}/opportunities`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{opp.title}</h1>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[opp.status] || ""}`}>{opp.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{circleName} · {opp.type.replace(/_/g, " ")} · risk {opp.riskLevel?.toLowerCase()} · created by {opp.createdByName || "management"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canSelfCommit && <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowCommit(true)}><Upload className="size-4 mr-1" /> Commit</Button>}
          {opp.projectId && <Button render={<Link href={`/circles/${circleId}/projects/${opp.projectId}/overview`} />} variant="outline" className="rounded-xl"><ArrowRight className="size-4 mr-1" /> Funded project</Button>}
        </div>
      </div>

      {opp.description && <p className="text-sm text-muted-foreground">{opp.description}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Funding</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="font-semibold text-lg">{opp.fundingPercent}%</span><span className="text-muted-foreground">{formatCurrency(opp.raised, symbol)} raised of {formatCurrency(opp.targetAmount, symbol)}</span></div>
            <ProgressBar percent={opp.fundingPercent} className="h-3" />
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span>{opp.investors} investors</span>
              {opp.minimumInvestment != null && <span>· Min {formatCurrency(opp.minimumInvestment, symbol)}</span>}
              {opp.maximumInvestment != null && <span>· Max {formatCurrency(opp.maximumInvestment, symbol)}</span>}
              {opp.closingDate && <span>· Closes {formatDate(opp.closingDate)}</span>}
            </div>
            {opp.expectedReturn != null && (
              <div className="rounded-xl border p-3 bg-emerald-50/40 flex items-center gap-2 text-sm"><Percent className="size-4 text-emerald-600" /><span className="font-medium">Expected return {opp.expectedReturn}%</span>{opp.expectedDuration && <span className="text-muted-foreground">over {opp.expectedDuration}</span>}</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="size-4" /> Governance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {opp.requiresApproval ? <p className="flex items-center gap-2"><ShieldAlert className="size-4 text-amber-600" /> Approval required before opening</p> : <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-muted-foreground" /> No approval gate</p>}
            {opp.requiresVote ? <p className="flex items-center gap-2"><Sparkles className="size-4 text-purple-600" /> Member vote required before opening</p> : <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-muted-foreground" /> No vote gate</p>}
          </CardContent>
        </Card>
      </div>

      {canManage && (opp.status === "DRAFT" || opp.status === "OPEN") && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Management actions</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 flex-wrap">
            {opp.status === "DRAFT" && opp.requiresApproval && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => action("approve")}>Approve (separate admin)</Button>}
            {opp.status === "DRAFT" && opp.requiresVote && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => action("record-vote-passed")}>Record vote passed</Button>}
            {opp.status === "DRAFT" && <Button size="sm" className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => action("open")}>Open</Button>}
            {opp.status === "OPEN" && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => action("close")}>Close</Button>}
            <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => action("cancel")}>Cancel</Button>
            {opp.fundingPercent >= 100 && (
              <Button size="sm" className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => action("convert")}><Coins className="size-4 mr-1" /> Convert to project</Button>
            )}
          </CardContent>
        </Card>
      )}

      {(canManage || canApprove) && commitments.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BadgeCheck className="size-4" /> Commitments (review)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {commitments.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm rounded-xl border p-2.5 flex-wrap gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.userName || c.userId}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${COMMITMENT_COLORS[c.status] || ""}`}>{c.status}</Badge>
                    {c.proofReference && <span className="text-[10px] text-muted-foreground">{c.proofReference}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold">{formatCurrency(c.amount, symbol)}</span>
                  {c.proofUrl && <a href={c.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] underline text-brand">proof</a>}
                  {c.status === "PAID" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 rounded-xl" onClick={() => fetch(`/api/circles/${circleId}/opportunities/${opportunityId}/commitments/${c.id}?action=confirm`, { method: "POST" }).then(async (r) => { if (!r.ok) throw new Error(); toast.success("Confirmed"); refresh() }).catch(() => toast.error("Failed"))}><CheckCircle2 className="size-3 mr-1" /> Confirm</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 rounded-xl" onClick={() => fetch(`/api/circles/${circleId}/opportunities/${opportunityId}/commitments/${c.id}?action=reject`, { method: "POST" }).then(async (r) => { if (!r.ok) throw new Error(); toast.success("Rejected"); refresh() }).catch(() => toast.error("Failed"))}><XCircle className="size-3 mr-1" /> Reject</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {documents.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="size-4" /> Documents</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {documents.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm rounded-lg border px-3 py-2 hover:bg-muted/40 transition-colors">
                <span className="flex items-center gap-2 min-w-0 truncate"><FileText className="size-4 text-brand shrink-0" /><span className="truncate">{d.name}</span></span>
                <span className="text-[10px] text-muted-foreground shrink-0">{d.mimeType} · {d.size ? `${(d.size / 1024).toFixed(0)} KB` : ""}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* My commitments */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> My commitments</CardTitle></CardHeader>
        <CardContent>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{canSelfCommit ? "You have not committed to this opportunity yet." : "No commitments."}</p>
          ) : (
            <div className="space-y-2">
              {mine.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm rounded-xl border p-3 flex-wrap gap-2">
                  <div>
                    <p className="font-semibold">{formatCurrency(c.amount, symbol)}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${COMMITMENT_COLORS[c.status] || ""}`}>{c.status}</Badge>
                      {c.proofReference && <span className="text-[10px] text-muted-foreground">{c.proofReference}</span>}
                      <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(c.status === "PENDING" || c.status === "REJECTED") && <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setProvingId(c.id)}><Upload className="size-3.5 mr-1" /> Upload proof</Button>}
                    {(c.status === "PENDING" || c.status === "PAID") && <Button size="sm" variant="ghost" className="rounded-xl h-8 text-red-500" onClick={() => { fetch(`/api/circles/${circleId}/opportunities/${opportunityId}/commitments/${c.id}?action=withdraw`, { method: "POST" }).then(async (r) => { if (!r.ok) throw new Error(); toast.success("Withdrawn"); refresh() }).catch(() => toast.error("Failed")) }}><Undo2 className="size-3.5 mr-1" /> Withdraw</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CommitDialog open={showCommit} onOpenChange={setShowCommit} circleId={circleId} opportunityId={opportunityId} symbol={symbol} opp={opp} onDone={() => { refresh(); setShowCommit(false) }} />
      <ProofDialog provingId={provingId} circleId={circleId} opportunityId={opportunityId} onClose={() => setProvingId(null)} onDone={() => { refresh(); setProvingId(null) }} />
    </div>
  )
}

function CommitDialog({ open, onOpenChange, circleId, opportunityId, symbol, opp, onDone }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  circleId: string
  opportunityId: string
  symbol: string
  opp: { minimumInvestment: number | null; expectedReturn: number | null; riskLevel: string } | null
  onDone: () => void
}) {
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!Number(amount) || Number(amount) <= 0) return toast.error("Enter an amount")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/opportunities/${opportunityId}/commitments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to commit")
      toast.success("Commitment recorded — upload proof next")
      setAmount(""); onDone()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Commit to this opportunity</DialogTitle><DialogDescription>Commit now, upload proof after payment, then track approval.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Label className="text-xs">Amount ({symbol})</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={opp?.minimumInvestment ? `Min ${opp.minimumInvestment}` : ""} className="rounded-xl text-lg font-semibold" />
          {opp?.expectedReturn != null && <p className="text-xs text-muted-foreground">Expected return {opp.expectedReturn}% · risk {opp.riskLevel?.toLowerCase()}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Committing..." : "Commit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProofDialog({ provingId, circleId, opportunityId, onClose, onDone }: {
  provingId: string | null
  circleId: string
  opportunityId: string
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!provingId || (!file && !reference.trim())) return toast.error("Add a file or reference")
    setSubmitting(true)
    try {
      const fd = new FormData()
      if (file) fd.append("file", file)
      if (reference.trim()) fd.append("reference", reference.trim())
      const r = await fetch(`/api/circles/${circleId}/opportunities/${opportunityId}/commitments/${provingId}?action=proof`, { method: "POST", body: fd })
      if (!r.ok) throw new Error("Failed to submit proof")
      toast.success("Proof submitted — awaiting review")
      setFile(null); setReference(""); onDone()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!provingId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Upload proof of payment</DialogTitle><DialogDescription>JPG, PNG, WebP or PDF · max 5MB. Reviewed by management before confirmation.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Label className="text-xs">Proof file</Label>
          <label className="flex items-center gap-3 rounded-xl border border-dashed p-3 cursor-pointer hover:bg-muted/40 transition-colors">
            <span className="size-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0"><Upload className="size-4 text-brand" /></span>
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{file ? file.name : "Choose file"}</span>
            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <Label className="text-xs">Reference</Label>
          <Textarea value={reference} onChange={(e) => setReference(e.target.value)} rows={2} className="rounded-xl" placeholder="Bank reference or transaction ID" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Submitting..." : "Submit proof"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}