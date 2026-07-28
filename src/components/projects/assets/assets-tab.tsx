"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Box, DollarSign, MapPin, TrendingDown, Edit, Trash2, Calculator, Loader2 } from "lucide-react"
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
import { formatCurrency, formatDate, ASSET_TYPE_LABELS, ASSET_STATUS_COLORS } from "../types"
import type { AssetData, CircleData } from "../types"

interface AssetsTabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

export function AssetsTab({ circle, circleId, projectId }: AssetsTabProps) {
  const [assets, setAssets] = useState<AssetData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [selected, setSelected] = useState<AssetData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const [form, setForm] = useState({
    name: "", type: "OTHER", purchaseAmount: "", currentValue: "",
    location: "", notes: "", depreciationMethod: "NONE", depreciationRate: "",
  })

  const symbol = circle?.currency || "ZAR"

  const fetchAssets = useCallback(async () => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/assets`)
      if (r.ok) setAssets(await r.json())
    } finally {
      setLoading(false)
    }
  }, [circleId, projectId])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  const resetForm = () => setForm({ name: "", type: "OTHER", purchaseAmount: "", currentValue: "", location: "", notes: "", depreciationMethod: "NONE", depreciationRate: "" })

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, type: form.type,
          purchaseAmount: form.purchaseAmount ? Number(form.purchaseAmount) : undefined,
          currentValue: form.currentValue ? Number(form.currentValue) : undefined,
          location: form.location || undefined, notes: form.notes || undefined,
          depreciationMethod: form.depreciationMethod === "NONE" ? undefined : form.depreciationMethod,
          depreciationRate: form.depreciationRate ? Number(form.depreciationRate) : undefined,
        }),
      })
      if (r.ok) { toast.success("Asset created"); setShowCreate(false); resetForm(); fetchAssets() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const handleMarkSold = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/assets?action=sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected.id, saleValue: Number(form.currentValue || 0) }),
      })
      if (r.ok) { toast.success("Asset marked as sold"); setShowSell(false); setSelected(null); fetchAssets() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const handleDepreciate = async (assetId: string) => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/assets?action=depreciate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      })
      if (r.ok) { toast.success("Depreciation calculated"); fetchAssets() }
      else toast.error((await r.json()).error || "Failed")
    } catch { toast.error("Failed to calculate depreciation") }
  }

  const filtered = assets.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false
    if (filterStatus !== "all" && a.status !== filterStatus) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPurchase = assets.reduce((s, a) => s + Number(a.purchaseAmount || 0), 0)
  const totalCurrent = assets.reduce((s, a) => s + Number(a.currentValue || 0), 0)
  const totalDepreciation = assets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0)
  const activeCount = assets.filter((a) => a.status === "ACTIVE" || a.status === "PURCHASED").length

  if (loading) return <AssetsSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search assets..." className="w-40 sm:w-56 rounded-xl h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "all")}>
            <SelectTrigger className="w-28 h-8 rounded-xl text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>{Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}<SelectItem value="all">All Types</SelectItem></SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
            <SelectTrigger className="w-28 h-8 rounded-xl text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{Object.entries(ASSET_STATUS_COLORS).map(([k]) => <SelectItem key={k} value={k}>{k}</SelectItem>)}<SelectItem value="all">All Status</SelectItem></SelectContent>
          </Select>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => { resetForm(); setShowCreate(true) }}><Plus className="size-3.5 mr-1" /> Add Asset</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<Box className="size-4" />} label="Total Assets" value={String(assets.length)} />
        <SummaryCard icon={<DollarSign className="size-4" />} label="Purchase Cost" value={formatCurrency(totalPurchase, symbol)} />
        <SummaryCard icon={<DollarSign className="size-4" />} label="Current Value" value={formatCurrency(totalCurrent, symbol)} />
        <SummaryCard icon={<TrendingDown className="size-4" />} label="Depreciation" value={formatCurrency(totalDepreciation, symbol)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No assets found</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="rounded-2xl hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">{a.name}</p>
                      <Badge className={`text-[10px] ${ASSET_STATUS_COLORS[a.status] || ""}`}>{a.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{ASSET_TYPE_LABELS[a.type] || a.type}</span>
                      {a.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {a.location}</span>}
                      {a.purchaseAmount && <span>Purch: {formatCurrency(Number(a.purchaseAmount), symbol)}</span>}
                      {a.currentValue && <span>Value: {formatCurrency(Number(a.currentValue), symbol)}</span>}
                      {a.depreciationMethod && a.depreciationMethod !== "NONE" && <span>Dep: {a.depreciationMethod} {a.depreciationRate ? `${Number(a.depreciationRate) * 100}%` : ""}</span>}
                      {a.purchaseDate && <span>Purchased: {formatDate(a.purchaseDate)}</span>}
                    </div>
                    {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon-xs" className="rounded-lg" onClick={() => handleDepreciate(a.id)} title="Calculate Depreciation"><Calculator className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-xs" className="rounded-lg" onClick={() => { setSelected(a); setForm({ ...form, currentValue: String(a.saleValue || a.currentValue || 0) }); setShowSell(true) }} title="Mark Sold"><DollarSign className="size-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name *</Label><Input className="rounded-xl h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? "OTHER" })}><SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Purchase Amount</Label><Input className="rounded-xl h-9" type="number" value={form.purchaseAmount} onChange={(e) => setForm({ ...form, purchaseAmount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Current Value</Label><Input className="rounded-xl h-9" type="number" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} /></div>
              <div><Label className="text-xs">Location</Label><Input className="rounded-xl h-9" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Depreciation</Label><Select value={form.depreciationMethod} onValueChange={(v) => setForm({ ...form, depreciationMethod: v ?? "NONE" })}><SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">None</SelectItem><SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem><SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Dep. Rate</Label><Input className="rounded-xl h-9" type="number" step="0.01" placeholder="0.10 = 10%" value={form.depreciationRate} onChange={(e) => setForm({ ...form, depreciationRate: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea className="rounded-xl" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={handleCreate} disabled={submitting || !form.name}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSell} onOpenChange={setShowSell}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Mark Asset as Sold</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Asset: <span className="font-medium text-foreground">{selected?.name}</span></p>
            <div><Label className="text-xs">Sale Value</Label><Input className="rounded-xl h-9" type="number" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setShowSell(false); setSelected(null) }}>Cancel</Button>
            <Button className="rounded-xl bg-amber-600 hover:bg-amber-700" onClick={handleMarkSold} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Mark Sold"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div>
        <p className="text-base sm:text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

function AssetsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}
      </div>
      {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>)}
    </div>
  )
}
