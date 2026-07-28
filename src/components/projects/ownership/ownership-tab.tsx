"use client"

import { useState, useEffect, useCallback } from "react"
import { PieChart, Users, DollarSign, Percent, Plus, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency } from "../types"
import type { CircleData } from "../types"

interface OwnershipTabProps { circle: CircleData; circleId: string; projectId: string }

interface Owner { id: string; name?: string | null; email?: string | null; ownership: number; capital: number }
interface Snapshot { id: string; version: number; status: string; totalCapital: string; effectiveDate?: string | null; approvedAt?: string | null; entries: any[]; proposalNote?: string | null }

export function OwnershipTab({ circle, circleId, projectId }: OwnershipTabProps) {
  const [effective, setEffective] = useState<Snapshot | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [showPropose, setShowPropose] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [selected, setSelected] = useState<Snapshot | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<"effective" | "history">("effective")

  const symbol = circle?.currency || "ZAR"

  const fetchData = useCallback(async () => {
    try {
      const [effR, histR] = await Promise.all([
        fetch(`/api/circles/${circleId}/projects/${projectId}/ownership?view=effective`),
        fetch(`/api/circles/${circleId}/projects/${projectId}/ownership?view=history`),
      ])
      if (effR.ok) setEffective(await effR.json())
      if (histR.ok) {
        const h = await histR.json()
        setHistory(h.snapshots || [])
      }
    } finally { setLoading(false) }
  }, [circleId, projectId])

  useEffect(() => { fetchData() }, [fetchData])

  const owners: Owner[] = (effective?.entries ?? []).map((e: any) => ({
    id: e.id,
    name: e.participant?.user?.name ?? e.participant?.externalName ?? null,
    email: e.participant?.user?.email ?? null,
    ownership: Number(e.ownershipPercentage),
    capital: Number(e.capitalContributed),
  }))

  const handlePropose = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/ownership?action=propose`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      })
      if (r.ok) { toast.success("Ownership snapshot proposed"); setShowPropose(false); fetchData() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const handleApprove = async (snapshotId: string) => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/ownership?action=approve`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId }),
      })
      if (r.ok) { toast.success("Snapshot approved"); fetchData() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const handleReject = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/ownership?action=reject`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId: selected.id, reason }),
      })
      if (r.ok) { toast.success("Snapshot rejected"); setShowReject(false); setSelected(null); setReason(""); fetchData() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  if (loading) return <OwnershipSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl bg-muted p-0.5">
          <button onClick={() => setView("effective")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === "effective" ? "bg-background shadow-sm" : ""}`}>Effective</button>
          <button onClick={() => setView("history")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === "history" ? "bg-background shadow-sm" : ""}`}>History</button>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowPropose(true)}><Plus className="size-3.5 mr-1" /> Propose Snapshot</Button>
      </div>

      {view === "effective" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={<Users className="size-4" />} label="Total Owners" value={String(owners.length)} />
            <SummaryCard icon={<DollarSign className="size-4" />} label="Total Capital" value={formatCurrency(Number(effective?.totalCapital ?? 0), symbol)} />
            <SummaryCard icon={<Percent className="size-4" />} label="Ownership %" value={`${owners.reduce((s, o) => s + o.ownership, 0)}%`} />
            <SummaryCard icon={<PieChart className="size-4" />} label="Version" value={`v${effective?.version ?? "-"}`} />
          </div>

          {owners.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No ownership data. Propose a snapshot to calculate ownership from capital contributions.</p></CardContent></Card>
          ) : (
            <Card className="rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Owners</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {owners.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-xl border">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-brand/10 flex items-center justify-center text-xs font-bold text-brand shrink-0">{(o.name || o.email || "?")[0]?.toUpperCase()}</div>
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{o.name || o.email || "Unknown"}</p><p className="text-xs text-muted-foreground">{formatCurrency(o.capital, symbol)}</p></div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="h-2 w-24 rounded-full bg-muted overflow-hidden hidden sm:block"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(o.ownership, 100)}%` }} /></div>
                        <span className="text-sm font-bold w-14 text-right">{o.ownership}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {history.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No ownership history</p></CardContent></Card>
          ) : (
            history.map((snap) => (
              <Card key={snap.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">v{snap.version}</span>
                        <Badge className={`text-[10px] ${snap.status === "EFFECTIVE" ? "bg-emerald-100 text-emerald-700" : snap.status === "PROPOSED" ? "bg-blue-100 text-blue-700" : snap.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{snap.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Capital: {formatCurrency(Number(snap.totalCapital), symbol)} · {snap.entries.length} owners</p>
                      {snap.effectiveDate && <p className="text-xs text-muted-foreground">Effective: {new Date(snap.effectiveDate).toLocaleDateString()}</p>}
                    </div>
                    {snap.status === "PROPOSED" && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" onClick={() => handleApprove(snap.id)} disabled={submitting}><CheckCircle2 className="size-3 mr-1" /> Approve</Button>
                        <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs text-red-600" onClick={() => { setSelected(snap); setReason(""); setShowReject(true) }}><XCircle className="size-3 mr-1" /> Reject</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={showPropose} onOpenChange={setShowPropose}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Propose Ownership Snapshot</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will calculate ownership percentages from all confirmed capital contributions for this project.</p>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowPropose(false)}>Cancel</Button>
            <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={handlePropose} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Propose"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Reject Snapshot</DialogTitle></DialogHeader>
          <div><Label className="text-xs">Reason</Label><Textarea className="rounded-xl" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setShowReject(false); setSelected(null) }}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleReject} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className="text-base sm:text-lg font-bold">{value}</p></CardContent></Card>
}

function OwnershipSkeleton() {
  return <div className="space-y-4"><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}</div>{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>)}</div>
}
