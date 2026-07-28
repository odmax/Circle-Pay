"use client"

import { useState, useEffect, useCallback } from "react"
import { Waves, DollarSign, Users, CheckCircle2, Plus, Loader2, Play, Ban } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "../types"
import type { CircleData } from "../types"

interface DistributionsTabProps { circle: CircleData; circleId: string; projectId: string }
interface DistItem { id: string; name: string; status: string; totalProfit: string; totalDistributed: string; method: string; createdAt: string; items?: any[] }
interface Owner { id: string; name?: string | null; email?: string | null; contribution: number; ownership: number }

export function DistributionsTab({ circle, circleId, projectId }: DistributionsTabProps) {
  const [distributions, setDistributions] = useState<DistItem[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [method, setMethod] = useState("BY_CONTRIBUTION_SHARE")
  const [submitting, setSubmitting] = useState(false)

  const symbol = circle?.currency || "ZAR"

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/distributions`)
      if (r.ok) {
        const data = await r.json()
        setDistributions(data.distributions || [])
        setOwners(data.ownership?.owners || [])
      }
    } finally { setLoading(false) }
  }, [circleId, projectId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/distributions/create`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, method }),
      })
      if (r.ok) { toast.success("Distribution created"); setShowCreate(false); setName(""); fetchData() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const handleAction = async (distId: string, action: string) => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/distributions/${distId}/${action}`, { method: "POST" })
      if (r.ok) { toast.success(`Distribution ${action}ed`); fetchData() }
      else toast.error((await r.json()).error || "Failed")
    } catch { toast.error("Failed") }
  }

  const totalProfit = distributions.reduce((s, d) => s + Number(d.totalProfit || 0), 0)
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.totalDistributed || 0), 0)
  const pendingCount = distributions.filter((d) => d.status === "PENDING_APPROVAL" || d.status === "DRAFT").length

  if (loading) return <DistributionsSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Profit Distributions</h2>
        <Button size="sm" className="rounded-xl" onClick={() => { setShowCreate(true); setName(""); setMethod("BY_CONTRIBUTION_SHARE") }}><Plus className="size-3.5 mr-1" /> Create Distribution</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<Waves className="size-4" />} label="Total Profit" value={formatCurrency(totalProfit, symbol)} color="text-emerald-600" />
        <SummaryCard icon={<DollarSign className="size-4" />} label="Distributed" value={formatCurrency(totalDistributed, symbol)} />
        <SummaryCard icon={<CheckCircle2 className="size-4" />} label="Pending" value={String(pendingCount)} />
        <SummaryCard icon={<Users className="size-4" />} label="Owners" value={String(owners.length)} />
      </div>

      {owners.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ownership</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {owners.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm">
                  <div className="size-6 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand">{(o.name || o.email || "?")[0]?.toUpperCase()}</div>
                  <span className="truncate max-w-[100px]">{o.name || o.email}</span>
                  <span className="font-bold">{o.ownership}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {distributions.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No distributions yet. Create one to allocate profits to owners.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {distributions.map((d) => (
            <Card key={d.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{d.name}</span>
                      <Badge className={`text-[10px] ${d.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : d.status === "PAID" ? "bg-brand/10 text-brand" : d.status === "DRAFT" ? "bg-gray-100 text-gray-600" : d.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{d.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Profit: {formatCurrency(Number(d.totalProfit), symbol)}</span>
                      <span>Paid: {formatCurrency(Number(d.totalDistributed), symbol)}</span>
                      <span>Method: {d.method}</span>
                      <span>{formatDate(d.createdAt)}</span>
                      {d.items?.length && <span>{d.items.length} recipients</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {d.status === "DRAFT" || d.status === "PENDING_APPROVAL" ? (
                      <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" onClick={() => handleAction(d.id, "approve")}><CheckCircle2 className="size-3 mr-1" /> Approve</Button>
                    ) : null}
                    {d.status === "APPROVED" ? (
                      <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" onClick={() => handleAction(d.id, "paid")}><Play className="size-3 mr-1" /> Mark Paid</Button>
                    ) : null}
                    {(d.status === "DRAFT" || d.status === "PENDING_APPROVAL") ? (
                      <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs text-red-600" onClick={() => handleAction(d.id, "cancel")}><Ban className="size-3 mr-1" /> Cancel</Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Create Distribution</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input className="rounded-xl h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q1 2026 Distribution" /></div>
            <div><Label className="text-xs">Method</Label><Select value={method} onValueChange={(v) => setMethod(v ?? "BY_CONTRIBUTION_SHARE")}><SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BY_CONTRIBUTION_SHARE">By Contribution Share</SelectItem><SelectItem value="EQUAL_SHARE">Equal Share</SelectItem><SelectItem value="CUSTOM">Custom</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={handleCreate} disabled={submitting || !name}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-base sm:text-lg font-bold ${color || ""}`}>{value}</p></CardContent></Card>
}

function DistributionsSkeleton() {
  return <div className="space-y-4"><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}</div>{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>)}</div>
}
