"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Record<string, unknown>>({})
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingPricing, setSavingPricing] = useState(false)
  const [savingLimits, setSavingLimits] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [addingFeature, setAddingFeature] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/owner/plans/${planId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { toast.error(d.error); setPlan(null) } else { setPlan(d); setEdit(d) } })
      .catch(() => { setPlan(null) })
      .finally(() => setLoading(false))
  }, [planId])

  async function save(fields: Record<string, unknown>, tag: string) {
    const s = tag === "header" ? setSavingHeader : tag === "pricing" ? setSavingPricing : setSavingLimits
    // Strip undefined/null/NaN to avoid sending bad data
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue
      if (typeof v === "number" && Number.isNaN(v)) continue
      clean[k] = v
    }
    s(true)
    try {
      const r = await fetch(`/api/owner/plans/${planId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") } else { toast.success("Saved"); setPlan(d); setEdit(d) }
    } catch { toast.error("Failed") }
    s(false)
  }

  async function addFeature() {
    if (!newKey || !newLabel) return; setAddingFeature(true)
    try {
      const r = await fetch(`/api/owner/plans/${planId}/features`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: newKey.toUpperCase().replace(/\s/g, "_"), label: newLabel, valueType: "BOOLEAN", value: true }) })
      if (!r.ok) { toast.error("Failed"); return }
      toast.success("Feature added"); setNewKey(""); setNewLabel(""); router.refresh()
    } catch { toast.error("Failed") }
    setAddingFeature(false)
  }

  async function toggleFeature(featureId: string, isEnabled: boolean) {
    try {
      await fetch(`/api/owner/plans/${planId}/features/${featureId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isEnabled: !isEnabled }) })
      router.refresh()
    } catch { toast.error("Failed") }
  }

  async function removeFeature(featureId: string) {
    try { await fetch(`/api/owner/plans/${planId}/features/${featureId}`, { method: "DELETE" }); router.refresh() } catch { toast.error("Failed") }
  }

  if (loading) return <div className="p-8"><Loader2 className="size-4 animate-spin" /></div>
  if (!plan) return <div className="p-8 text-muted-foreground">Plan not found</div>

  const features = (plan.planFeatures as Record<string, unknown>[]) || []
  const subs = (plan.subscriptions as Record<string, unknown>[]) || []
  const payments = (plan.paymentTransactions as Record<string, unknown>[]) || []

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Owner", href: "/owner" }, { label: "Plans", href: "/owner/plans" }, { label: (plan.name as string) || "Plan" }]} />
      <div className="flex items-center gap-3"><Link href="/owner/plans"><Button variant="ghost" size="sm" className="rounded-xl"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-2xl font-bold tracking-tight">{plan.name as string}</h1><Badge variant={plan.isArchived ? "secondary" : "default"} className={plan.isArchived ? "" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"}>{plan.isArchived ? "Archived" : "Active"}</Badge></div>

      {/* General Settings */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">General Settings</CardTitle></CardHeader><CardContent className="space-y-3">
        <EditableField label="Name" value={edit.name as string} onChange={(v) => setEdit({ ...edit, name: v })} />
        <EditableField label="Slug" value={edit.slug as string} onChange={(v) => setEdit({ ...edit, slug: v })} />
        <EditableField label="Description" value={edit.description as string} onChange={(v) => setEdit({ ...edit, description: v })} />
        <div className="flex items-center justify-between"><span className="text-sm">Currency</span><Select value={edit.currency as string} onValueChange={(v) => setEdit({ ...edit, currency: v })}><SelectTrigger className="rounded-xl w-32"><SelectValue /></SelectTrigger><SelectContent>{["ZAR","NGN","KES","GHS","USD","EUR","GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center justify-between"><span className="text-sm">Billing Interval</span><Select value={edit.interval as string} onValueChange={(v) => setEdit({ ...edit, interval: v })}><SelectTrigger className="rounded-xl w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MONTHLY">Monthly</SelectItem><SelectItem value="ANNUAL">Annual</SelectItem></SelectContent></Select></div>
        <div className="flex items-center justify-between"><span className="text-sm">Trial Days</span><Input value={edit.trialDays != null ? String(edit.trialDays) : "0"} onChange={(e) => setEdit({ ...edit, trialDays: Number(e.target.value) })} type="number" className="rounded-xl w-24" /></div>
        <div className="flex items-center justify-between"><span className="text-sm">Public</span><input type="checkbox" checked={!!edit.isPublic} onChange={(e) => setEdit({ ...edit, isPublic: e.target.checked })} /></div>
        <div className="flex items-center justify-between"><span className="text-sm">Sort Order</span><Input value={edit.sortOrder != null ? String(edit.sortOrder) : "0"} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} type="number" className="rounded-xl w-24" /></div>
        <Button onClick={() => save({ name: edit.name, slug: edit.slug, description: edit.description, currency: edit.currency, interval: edit.interval, trialDays: edit.trialDays, isPublic: edit.isPublic, sortOrder: edit.sortOrder }, "header")} disabled={savingHeader} className="rounded-xl bg-brand hover:bg-brand-600">{savingHeader ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
      </CardContent></Card>

      {/* Pricing */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">This plan uses one billing interval ({plan.interval as string}).</p>
        <div className="flex items-center justify-between"><span className="text-sm">Price</span><Input value={edit.price != null ? String(edit.price) : "0"} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} type="number" step="0.01" min="0" className="rounded-xl w-32" /></div>
        <div className="flex items-center justify-between"><span className="text-sm">Archived</span><input type="checkbox" checked={!!edit.isArchived} onChange={(e) => setEdit({ ...edit, isArchived: e.target.checked })} /></div>
        <Button onClick={() => save({ price: edit.price, isArchived: edit.isArchived }, "pricing")} disabled={savingPricing} className="rounded-xl bg-brand hover:bg-brand-600">{savingPricing ? <Loader2 className="size-4 animate-spin" /> : "Save Pricing"}</Button>
      </CardContent></Card>

      {/* Limits */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Limits (null = unlimited)</CardTitle></CardHeader><CardContent className="space-y-3">
        {[{ label: "Circle Limit", key: "circleLimit" }, { label: "Member Limit", key: "memberLimit" }, { label: "AI Message Limit", key: "aiMessageLimit" }, { label: "Storage (MB)", key: "storageLimitMb" }, { label: "API Request Limit", key: "apiRequestLimit" }].map((f) => (
          <div key={f.key} className="flex items-center justify-between"><span className="text-sm">{f.label}</span><Input value={edit[f.key] != null ? String(edit[f.key]) : ""} onChange={(e) => { const v = e.target.value; setEdit({ ...edit, [f.key]: v === "" ? null : Number(v) }) }} type="number" placeholder="unlimited" className="rounded-xl w-28" /></div>
        ))}
        <div className="flex items-center justify-between"><span className="text-sm">Support Level</span><Input value={(edit.supportLevel as string) || ""} onChange={(e) => setEdit({ ...edit, supportLevel: e.target.value || null })} placeholder="e.g. standard" className="rounded-xl w-40" /></div>
        <Button onClick={() => save({ circleLimit: edit.circleLimit, memberLimit: edit.memberLimit, aiMessageLimit: edit.aiMessageLimit, storageLimitMb: edit.storageLimitMb, apiRequestLimit: edit.apiRequestLimit, supportLevel: edit.supportLevel }, "limits")} disabled={savingLimits} className="rounded-xl bg-brand hover:bg-brand-600">{savingLimits ? <Loader2 className="size-4 animate-spin" /> : "Save Limits"}</Button>
      </CardContent></Card>

      {/* Feature Toggles */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Feature Toggles ({features.length})</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex gap-2"><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key (e.g. AI_ASSISTANT)" className="rounded-xl flex-1" /><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label" className="rounded-xl flex-1" /><Button onClick={addFeature} disabled={addingFeature || !newKey || !newLabel} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={async () => { await fetch("/api/owner/plans/seed-features", { method: "POST" }); router.refresh() }}>Seed Default Features</Button>
        </div>
        {features.length === 0 ? <p className="text-sm text-muted-foreground">No feature toggles</p> : (
          <div className="space-y-1">{features.map((f) => (
            <div key={f.id as string} className="flex items-center justify-between text-sm border-b pb-1.5">
              <div className="flex items-center gap-2"><Badge variant={f.isEnabled ? "default" : "outline"} className={`text-[10px] ${f.isEnabled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}`}>{f.isEnabled ? "ON" : "OFF"}</Badge><span>{f.label as string}</span><code className="text-[10px] text-muted-foreground">{f.key as string}</code></div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs rounded" onClick={() => toggleFeature(f.id as string, f.isEnabled as boolean)}>{f.isEnabled ? "Disable" : "Enable"}</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs rounded text-red-600" onClick={() => removeFeature(f.id as string)}><Trash2 className="size-3" /></Button>
              </div>
            </div>
          ))}</div>
        )}
      </CardContent></Card>

      {/* Subscribers */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Subscribers ({subs.length})</CardTitle></CardHeader><CardContent className="p-0">
        {subs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No subscribers</p> : (
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">User</th><th className="p-3">Status</th><th className="p-3">Period End</th><th className="p-3 pr-4">Created</th></tr></thead>
            <tbody>{subs.map((s) => (
              <tr key={s.id as string} className="border-b hover:bg-muted/30">
                <td className="p-3 pl-4"><Link href={`/owner/users/${(s.user as Record<string, unknown>)?.id}`} className="font-medium hover:underline">{(s.user as Record<string, unknown>)?.name as string || "—"}</Link><p className="text-xs text-muted-foreground">{(s.user as Record<string, unknown>)?.email as string}</p></td>
                <td className="p-3"><Badge variant="outline" className={s.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "text-[10px]"}>{s.status as string}</Badge></td>
                <td className="p-3 text-muted-foreground">{new Date(s.currentPeriodEnd as string).toLocaleDateString()}</td>
                <td className="p-3 pr-4 text-muted-foreground">{new Date(s.createdAt as string).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </CardContent></Card>

      {/* Revenue */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="text-center"><div className="text-xl font-bold text-emerald-600">R{Number(plan.revenue || 0).toLocaleString()}</div><p className="text-xs text-muted-foreground">Total Revenue</p></div>
          <div className="text-center"><div className="text-xl font-bold">{Number(plan.paidCount)}</div><p className="text-xs text-muted-foreground">Paid</p></div>
          <div className="text-center"><div className="text-xl font-bold text-red-500">{Number(plan.failedCount)}</div><p className="text-xs text-muted-foreground">Failed</p></div>
        </div>
        {payments.length > 0 && (
          <div className="mt-4"><p className="text-xs font-medium mb-2">Recent Payments</p>
            <div className="space-y-1">{payments.slice(0, 10).map((p) => (
              <div key={p.id as string} className="flex items-center justify-between text-xs border-b pb-1">
                <span>{String((p.user as { name?: string; email?: string })?.name || (p.user as { email?: string })?.email) || "—"}</span>
                <span>R{Number(p.amount).toLocaleString()}</span>
                <Badge variant="outline" className={p.status === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "border-red-200 bg-red-50 text-red-700 text-[10px]"}>{p.status as string}</Badge>
              </div>
            ))}</div>
          </div>
        )}
      </CardContent></Card>

      {/* Danger Zone */}
      <Card className="rounded-2xl border-red-200"><CardHeader><CardTitle className="text-base text-red-600">Danger Zone</CardTitle></CardHeader><CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Archive makes the plan unavailable to new subscribers but does not cancel existing subscriptions.</p>
        <Button variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50" onClick={() => save({ isArchived: true }, "pricing")}>{plan.isArchived ? "Reactivate" : "Archive Plan"}</Button>
      </CardContent></Card>
    </div>
  )
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="flex items-center justify-between"><span className="text-sm w-32 shrink-0">{label}</span><Input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl flex-1" /></div>
}
