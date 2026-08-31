"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Rocket, Plus, Upload, ShieldAlert, Clock, ArrowUpRight, Percent, Wallet, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/components/projects/types"
import { ProgressBar } from "@/components/projects/charts"

export interface OpportunityItem {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  targetAmount: number
  raised: number
  fundingPercent: number
  minimumInvestment: number | null
  maximumInvestment: number | null
  expectedReturn: number | null
  expectedDuration: string | null
  riskLevel: string
  coverImage: string | null
  openDate: string | null
  closingDate: string | null
  requiresApproval: boolean
  requiresVote: boolean
  investors: number
  projectId: string | null
  createdByName: string | null
  myCommitted: number
  myConfirmed: number
  myPending: number
}

export interface MyOpportunity {
  id: string
  title: string
  status: string
  committed: number
  confirmed: number
  pending: number
  ownershipEstimate: number
  expectedReturn: number | null
  closingDate: string | null
  projectId: string | null
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FUNDED: "border-brand-200 bg-brand-50 text-brand-700",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

const RISK_COLORS: Record<string, string> = {
  LOW: "text-emerald-600",
  MEDIUM: "text-amber-600",
  HIGH: "text-red-500",
}

export function OpportunitiesIndex({ circleId, circleName, currency, canCreate }: {
  circleId: string
  circleName: string
  currency: string
  canCreate: boolean
}) {
  const symbol = currency || "ZAR"
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([])
  const [myOpportunities, setMyOpportunities] = useState<MyOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = useState("open")
  const [showCreate, setShowCreate] = useState(false)
  const [commitFor, setCommitFor] = useState<OpportunityItem | null>(null)
  const [closingSoonCount, setClosingSoonCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/opportunities`)
        if (!r.ok) throw new Error("Failed to load opportunities")
        const data = await r.json()
        if (!cancelled) {
          const list: OpportunityItem[] = data.opportunities || []
          setOpportunities(list)
          setMyOpportunities(data.myOpportunities || [])
          setError(null)
          setClosingSoonCount(list.filter((o) => o.status === "OPEN" && o.closingDate && new Date(o.closingDate).getTime() - Date.now() < 7 * 86400000).length)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1) }

  const open = opportunities.filter((o) => o.status === "OPEN")
  const funded = opportunities.filter((o) => o.status === "FUNDED")

  const filtered = tab === "open" ? open : tab === "funded" ? funded : tab === "mine" ? opportunities.filter((o) => o.myCommitted > 0 || tab !== "mine") : opportunities

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investment Opportunities</h1>
          <p className="text-muted-foreground">{circleName} — raise capital for projects and convert funded opportunities into projects</p>
        </div>
        {canCreate && (
          <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-1" /> New Opportunity
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open Opportunities" value={String(open.length)} icon={<Rocket className="size-4" />} />
        <Stat label="Funding Being Raised" value={formatCurrency(open.reduce((s, o) => s + o.targetAmount, 0), symbol)} icon={<Wallet className="size-4" />} />
        <Stat label="Closing Soon (7d)" value={String(closingSoonCount)} icon={<Clock className="size-4" />} color={closingSoonCount > 0 ? "text-amber-600" : ""} />
        <Stat label="Recently Funded" value={String(funded.length)} icon={<Sparkles className="size-4" />} />
      </div>

      {/* My opportunities */}
      <Card className="rounded-2xl border-brand/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm">My Opportunities</CardTitle></CardHeader>
        <CardContent>
          {myOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">You have no active commitments yet.</p>
          ) : (
            <div className="space-y-1.5">
              {myOpportunities.map((m) => (
                <Link key={m.id} href={`/circles/${circleId}/opportunities/${m.id}`} className="flex items-center justify-between text-sm rounded-lg border border-border/40 px-3 py-2 hover:bg-muted/40 transition-colors">
                  <span className="min-w-0 truncate font-medium">{m.title}</span>
                  <span className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-muted-foreground">Committed {formatCurrency(m.committed, symbol)}</span>
                    {m.confirmed > 0 && <span className="text-emerald-600">Confirmed {formatCurrency(m.confirmed, symbol)}</span>}
                    {m.ownershipEstimate > 0 && <span className="text-brand">Ownership {m.ownershipEstimate}%</span>}
                    {m.expectedReturn != null && <span className="text-brand">Est. return {formatCurrency(m.expectedReturn, symbol)}</span>}
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[m.status] || ""}`}>{m.status}</Badge>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[["open", "Open"], ["funded", "Funded"], ["all", "All"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${tab === id ? "bg-brand text-white border-brand" : "bg-background border-border text-muted-foreground hover:border-brand/50 hover:text-brand"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <IndexSkeleton /> : error ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-red-500">{error}</p><Button variant="outline" className="rounded-xl mt-3" onClick={refresh}>Retry</Button></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-14 text-center">
          <Rocket className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium">No {tab === "mine" ? "committed" : tab === "open" ? "open" : ""} opportunities</p>
          <p className="text-sm text-muted-foreground mt-1">Investment opportunities give members a place to commit capital before a project is formed.</p>
          {canCreate && <Button className="rounded-xl mt-4 bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> Create one</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
{filtered.map((o) => (
            <OpportunityCard key={o.id} o={o} circleId={circleId} symbol={symbol} onCommit={() => setCommitFor(o)} />
          ))}
        </div>
      )}

      <CreateOpportunityDialog open={showCreate} onOpenChange={setShowCreate} circleId={circleId} onCreated={refresh} />
      <CommitDialog opp={commitFor} circleId={circleId} symbol={symbol} onClose={() => setCommitFor(null)} onDone={refresh} />
    </div>
  )
}

function OpportunityCard({ o, circleId, symbol, onCommit }: {
  o: OpportunityItem
  circleId: string
  symbol: string
  onCommit: () => void
}) {
  const isOpen = o.status === "OPEN"
  return (
    <Card className="rounded-2xl flex flex-col overflow-hidden group hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold truncate group-hover:text-brand transition-colors">{o.title}</h3>
            <p className="text-[10px] text-muted-foreground capitalize">{o.type.replace(/_/g, " ")}{o.expectedDuration ? ` · ${o.expectedDuration}` : ""}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[o.status] || ""}`}>{o.status}</Badge>
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="font-semibold">{o.fundingPercent}% funded</span>
            <span className="text-muted-foreground">{formatCurrency(o.raised, symbol)} / {formatCurrency(o.targetAmount, symbol)}</span>
          </div>
          <ProgressBar percent={o.fundingPercent} />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {o.expectedReturn != null && <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50"><Percent className="size-3 mr-0.5" /> {o.expectedReturn}%</Badge>}
          <span className={`font-medium ${RISK_COLORS[o.riskLevel] || ""}`}>Risk {o.riskLevel?.toLowerCase()}</span>
          <span className="text-muted-foreground">{o.investors} investors</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
          {o.requiresApproval && <span className="flex items-center gap-1"><ShieldAlert className="size-3" /> Approval required</span>}
          {o.requiresVote && <span className="flex items-center gap-1"><Sparkles className="size-3" /> Member vote</span>}
          {o.closingDate && <span className="flex items-center gap-1"><Clock className="size-3" /> Closes {formatDate(o.closingDate)}</span>}
        </div>

        {o.myCommitted > 0 && (
          <p className="text-[10px] text-brand-700 bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1">
            You committed {formatCurrency(o.myCommitted, symbol)}{o.myConfirmed > 0 ? ` · ${formatCurrency(o.myConfirmed, symbol)} confirmed` : ` · ${formatCurrency(o.myPending, symbol)} pending`}
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center gap-2">
          <Button render={<Link href={`/circles/${circleId}/opportunities/${o.id}`} />} variant="outline" size="sm" className="flex-1 rounded-xl">
            <ArrowUpRight className="size-3.5 mr-1" /> View
          </Button>
          {isOpen && (
            <Button size="sm" className="flex-1 rounded-xl bg-brand hover:bg-brand-600" onClick={onCommit}>
              <Upload className="size-3.5 mr-1" /> Commit
            </Button>
          )}
          {o.projectId && (
            <Button render={<Link href={`/circles/${circleId}/projects/${o.projectId}/overview`} />} variant="outline" size="sm" className="rounded-xl">
              Project
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, icon, color = "" }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div>
      <p className={`text-base sm:text-lg font-bold truncate ${color}`}>{value}</p>
    </CardContent></Card>
  )
}

function IndexSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="rounded-2xl" ><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-2 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>)}
    </div>
  )
}

interface CreateOpportunityForm {
  title: string
  description?: string
  type: string
  targetAmount: string
  minimumInvestment: string
  maximumInvestment: string
  openDate: string
  closingDate: string
  expectedReturn: string
  expectedDuration: string
  riskLevel: string
  requiresApproval?: boolean
  requiresVote?: boolean
}

function CreateOpportunityDialog({ open, onOpenChange, circleId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; onCreated: () => void }) {
  const [form, setForm] = useState<CreateOpportunityForm>({ title: "", type: "general", targetAmount: "", minimumInvestment: "", maximumInvestment: "", openDate: "", closingDate: "", expectedReturn: "", expectedDuration: "", riskLevel: "MEDIUM" })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!form.title.trim() || !form.targetAmount) return toast.error("Title and target amount are required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/opportunities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, type: form.type, description: form.description || undefined,
          targetAmount: Number(form.targetAmount),
          minimumInvestment: form.minimumInvestment ? Number(form.minimumInvestment) : undefined,
          maximumInvestment: form.maximumInvestment ? Number(form.maximumInvestment) : undefined,
          openDate: form.openDate || null, closingDate: form.closingDate || null,
          expectedReturn: form.expectedReturn ? Number(form.expectedReturn) : undefined,
          expectedDuration: form.expectedDuration || undefined, riskLevel: form.riskLevel || "MEDIUM",
          requiresApproval: form.requiresApproval, requiresVote: form.requiresVote,
        }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to create")
      toast.success("Opportunity created")
      onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New Investment Opportunity</DialogTitle><DialogDescription>Set the raise parameters. Open it when you are ready — approval and votes can be required before opening.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Second Property Fund" className="rounded-xl" /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl" rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Target raise (${"R"})`}><Input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} placeholder="500000" className="rounded-xl" /></Field>
            <Field label="Category"><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v || "general" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="property">Property</SelectItem><SelectItem value="business">Business</SelectItem><SelectItem value="equity">Equity</SelectItem><SelectItem value="debt">Debt</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></Field>
            <Field label="Minimum investment"><Input type="number" value={form.minimumInvestment} onChange={(e) => setForm({ ...form, minimumInvestment: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Maximum investment (optional)"><Input type="number" value={form.maximumInvestment} onChange={(e) => setForm({ ...form, maximumInvestment: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Open date"><Input type="date" value={form.openDate} onChange={(e) => setForm({ ...form, openDate: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Closing date"><Input type="date" value={form.closingDate} onChange={(e) => setForm({ ...form, closingDate: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Expected return %"><Input type="number" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Expected duration"><Input value={form.expectedDuration} onChange={(e) => setForm({ ...form, expectedDuration: e.target.value })} placeholder="24 months" className="rounded-xl" /></Field>
            <Field label="Risk level"><Select value={form.riskLevel} onValueChange={(v) => setForm({ ...form, riskLevel: v || "MEDIUM" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem></SelectContent></Select></Field>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span><span className="font-medium">Require approval before opening</span><span className="block text-[10px] text-muted-foreground">Opens only after a separate approval.</span></span><Switch checked={!!form.requiresApproval} onCheckedChange={(v) => setForm({ ...form, requiresApproval: v })} /></label>
            <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span><span className="font-medium">Require member vote before opening</span><span className="block text-[10px] text-muted-foreground">Creates a governance vote that must pass.</span></span><Switch checked={!!form.requiresVote} onCheckedChange={(v) => setForm({ ...form, requiresVote: v })} /></label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Creating..." : "Create opportunity"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CommitDialog({ opp, circleId, symbol, onClose, onDone }: { opp: OpportunityItem | null; circleId: string; symbol: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!opp || !Number(amount) || Number(amount) <= 0) return toast.error("Enter an amount")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/opportunities/${opp.id}/commitments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to commit")
      toast.success("Commitment recorded — upload proof next")
      onClose(); onDone(); setAmount(""); setReference("")
      window.location.href = `/circles/${circleId}/opportunities/${opp.id}?action=commit`
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!opp} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Commit to {opp?.title}</DialogTitle><DialogDescription>Commit your amount; you upload proof of payment afterwards and track approval.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          {opp?.expectedReturn != null && <p className="text-xs text-muted-foreground">Expected return {opp.expectedReturn}% · Risk {opp.riskLevel?.toLowerCase()}</p>}
          <Field label={`Amount (${symbol})`}><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(opp?.minimumInvestment || "")} className="rounded-xl" /></Field>
          <Field label="Reference (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-xl" placeholder="Payment reference" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Committing..." : "Commit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
}