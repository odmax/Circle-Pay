"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, TrendingUp, DollarSign, Receipt, FileText, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate, REVENUE_TYPE_LABELS, REVENUE_STATUS_COLORS } from "../types"
import type { RevenueData, CircleData } from "../types"

interface RevenueTabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

export function RevenueTab({ circle, circleId, projectId }: RevenueTabProps) {
  const [revenues, setRevenues] = useState<RevenueData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

  const [form, setForm] = useState({
    description: "", type: "SERVICE_INCOME", grossAmount: "", directCosts: "",
    amount: "", reference: "", revenueDate: "",
  })

  const symbol = circle?.currency || "ZAR"

  const fetchRevenues = useCallback(async () => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/revenue`)
      if (r.ok) setRevenues(await r.json())
    } finally {
      setLoading(false)
    }
  }, [circleId, projectId])

  useEffect(() => { fetchRevenues() }, [fetchRevenues])

  const resetForm = () => setForm({ description: "", type: "SERVICE_INCOME", grossAmount: "", directCosts: "", amount: "", reference: "", revenueDate: "" })

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/revenue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          type: form.type,
          grossAmount: Number(form.grossAmount),
          directCosts: Number(form.directCosts || 0),
          amount: Number(form.amount || form.grossAmount),
          reference: form.reference || undefined,
          revenueDate: form.revenueDate || undefined,
        }),
      })
      if (r.ok) { toast.success("Revenue recorded"); setShowCreate(false); resetForm(); fetchRevenues() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const filtered = revenues.filter((r) => {
    if (filterType !== "all" && r.type !== filterType) return false
    if (search && !(r.description || "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalGross = revenues.reduce((s, r) => s + Number(r.grossAmount || 0), 0)
  const totalCosts = revenues.reduce((s, r) => s + Number(r.directCosts || 0), 0)
  const totalNet = revenues.reduce((s, r) => s + Number(r.amount || 0), 0)
  const confirmedCount = revenues.filter((r) => r.status === "CONFIRMED").length

  if (loading) return <RevenueSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search revenue..." className="w-40 sm:w-56 rounded-xl h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "all")}>
            <SelectTrigger className="w-32 h-8 rounded-xl text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>{Object.entries(REVENUE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}<SelectItem value="all">All Types</SelectItem></SelectContent>
          </Select>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => { resetForm(); setShowCreate(true) }}><Plus className="size-3.5 mr-1" /> Record Revenue</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<DollarSign className="size-4" />} label="Gross Revenue" value={formatCurrency(totalGross, symbol)} color="text-emerald-600" />
        <SummaryCard icon={<TrendingUp className="size-4" />} label="Direct Costs" value={formatCurrency(totalCosts, symbol)} color="text-red-500" />
        <SummaryCard icon={<TrendingUp className="size-4" />} label="Net Revenue" value={formatCurrency(totalNet, symbol)} color="text-emerald-600" />
        <SummaryCard icon={<Receipt className="size-4" />} label="Entries" value={String(confirmedCount)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No revenue recorded yet</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.id} className="rounded-2xl hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">{r.description || REVENUE_TYPE_LABELS[r.type] || r.type}</p>
                      <Badge className={`text-[10px] ${REVENUE_STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Gross: {formatCurrency(Number(r.grossAmount), symbol)}</span>
                      <span>Costs: {formatCurrency(Number(r.directCosts), symbol)}</span>
                      <span className="font-medium text-emerald-600">Net: {formatCurrency(Number(r.amount), symbol)}</span>
                      {r.asset && <span>Asset: {r.asset.name}</span>}
                      {r.reference && <span>Ref: {r.reference}</span>}
                      {r.revenueDate && <span>{formatDate(r.revenueDate)}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle>Record Revenue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? "SERVICE_INCOME" })}><SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(REVENUE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Gross Amount *</Label><Input className="rounded-xl h-9" type="number" value={form.grossAmount} onChange={(e) => setForm({ ...form, grossAmount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Direct Costs</Label><Input className="rounded-xl h-9" type="number" value={form.directCosts} onChange={(e) => setForm({ ...form, directCosts: e.target.value })} /></div>
              <div><Label className="text-xs">Net Amount</Label><Input className="rounded-xl h-9" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Description</Label><Textarea className="rounded-xl" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Reference</Label><Input className="rounded-xl h-9" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
              <div><Label className="text-xs">Revenue Date</Label><Input className="rounded-xl h-9" type="date" value={form.revenueDate} onChange={(e) => setForm({ ...form, revenueDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={handleCreate} disabled={submitting || !form.grossAmount}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div>
        <p className={`text-base sm:text-lg font-bold ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function RevenueSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}
      </div>
      {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>)}
    </div>
  )
}
