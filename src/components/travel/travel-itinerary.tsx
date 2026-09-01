"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Plane, Building2, Bus, Ticket, UtensilsCrossed, Users, Timer, Plus,
  ArrowLeft, MapPin, Clock, XCircle, Bell, FileText, PenLine, ClipboardList,
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
import { formatDate } from "@/components/projects/types"
import { CURRENCIES } from "@/lib/constants"

type ItineraryItem = {
  id: string; type: string; title: string; date: string | null; startTime: string | null; endTime: string | null;
  location: string | null; description: string | null; bookingReference: string | null; cost: number | null;
  paidByName: string | null; status: string; notes: string | null;
  assigned: Array<{ userId: string; name: string | null }>
  booking: {
    id: string; provider: string | null; reference: string | null; bookingDate: string | null; amount: number | null;
    currency: string; paymentStatus: string; cancellationNotes: string | null
    documents: Array<{ id: string; name: string; url: string; size: number | null }>
  } | null
  documentCount: number
  updatedAt: string
}

function recentlyChanged(it: { updatedAt: string; status: string }): boolean {
  if (!it.updatedAt) return false
  return Date.now() - new Date(it.updatedAt).getTime() < 36 * 3600000
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  FLIGHT: <Plane className="size-4" />, HOTEL: <Building2 className="size-4" />, TRANSPORT: <Bus className="size-4" />,
  ACTIVITY: <Ticket className="size-4" />, RESTAURANT: <UtensilsCrossed className="size-4" />,
  MEETING_POINT: <Users className="size-4" />, FREE_TIME: <Timer className="size-4" />, CUSTOM: <ClipboardList className="size-4" />,
}
const ITEM_STATUS_COLORS: Record<string, string> = {
  PLANNED: "border-slate-200 bg-slate-50 text-slate-600",
  BOOKED: "border-blue-200 bg-blue-50 text-blue-700",
  CONFIRMED: "border-brand-200 bg-brand-50 text-brand-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}
const PAYMENT_COLORS: Record<string, string> = {
  PENDING: "border-slate-200 bg-slate-50 text-slate-600",
  UNPAID: "border-amber-200 bg-amber-50 text-amber-700",
  PARTIAL: "border-purple-200 bg-purple-50 text-purple-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REFUNDED: "border-red-200 bg-red-50 text-red-700",
}
const PAYMENTS = ["PENDING", "UNPAID", "PARTIAL", "PAID", "REFUNDED"]
const TYPES = ["FLIGHT", "HOTEL", "TRANSPORT", "ACTIVITY", "RESTAURANT", "MEETING_POINT", "FREE_TIME", "CUSTOM"]
const BOOKABLE = ["FLIGHT", "HOTEL", "TRANSPORT", "ACTIVITY"]

function money(n: number | null, code: string): string {
  if (n == null) return "—"
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function TravelItinerary({ circleId, circleName, currency, canManage }: {
  circleId: string
  circleName: string
  currency: string
  canManage: boolean
}) {
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<ItineraryItem | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/itinerary`)
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setItems(j.items || [])
      } catch { /* keep */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/members`)
        const j = await r.json()
        const list = Array.isArray(j) ? j : j.members
        if (!cancelled && Array.isArray(list)) setMembers(list.filter((m: any) => m.userId || m.id).map((m: any) => ({ userId: m.userId || m.id, name: m.name || m.user?.name || m.userId })))
      } catch { /* no members picker */ }
    })()
    return () => { cancelled = true }
  }, [circleId])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }
  const base = `/circles/${circleId}`

  const grouped = items.reduce<Record<string, ItineraryItem[]>>((acc, it) => {
    const key = it.date ? it.date.slice(0, 10) : "Unscheduled"
    ;(acc[key] = acc[key] || []).push(it)
    return acc
  }, {})
  const days = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`${base}/trip`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Itinerary & Bookings</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} — plan every flight, stay, ride and activity</p>
        </div>
        {canManage && <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowAdd(true)}><Plus className="size-4 mr-1" /> Add item</Button>}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>)}</div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-14 text-center">
          <Plane className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium">No itinerary items yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add flights, hotels, transport and activities so everyone knows what happens next.</p>
          {canManage && <Button className="mt-4 rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowAdd(true)}><Plus className="size-4 mr-1" /> Add first item</Button>}
        </CardContent></Card>
      ) : (
        days.map((day) => (
          <div key={day}>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{day === "Unscheduled" ? "Unscheduled" : formatDate(day)}</p>
            <div className="space-y-2">
              {grouped[day].map((it) => (
                <ItineraryCard key={it.id} it={it} circleId={circleId} symbol={currency} canManage={canManage} onEdit={() => setEditing(it)} onRefresh={refresh} />
              ))}
            </div>
          </div>
        ))
      )}

      <AddItemDialog open={showAdd} onOpenChange={setShowAdd} circleId={circleId} members={members} initial={null} onSaved={refresh} />
      <AddItemDialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null) }} circleId={circleId} members={members} initial={editing} onSaved={() => { refresh(); setEditing(null) }} />
    </div>
  )
}

function ItineraryCard({ it, circleId, symbol, canManage, onEdit, onRefresh }: {
  it: ItineraryItem
  circleId: string
  symbol: string
  canManage: boolean
  onEdit: () => void
  onRefresh: () => void
}) {
  const [uploading, setUploading] = useState(false)

  const cancel = async () => {
    await fetch(`/api/circles/${circleId}/itinerary/${it.id}?action=cancel`, { method: "POST" })
    toast.success("Item cancelled"); onRefresh()
  }
  const setStatus = async (status: string) => {
    const r = await fetch(`/api/circles/${circleId}/itinerary/${it.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Status updated"); onRefresh()
  }
  const setPayment = async (bookingId: string, status: string) => {
    const r = await fetch(`/api/circles/${circleId}/itinerary/${it.id}?action=payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, status }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success(status === "PAID" ? "Payment recorded in the ledger" : "Payment status updated"); onRefresh()
  }
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/itinerary/${it.id}/documents`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Upload failed")
      toast.success("Document uploaded"); onRefresh()
    } catch (e) { toast.error((e as Error).message) } finally { setUploading(false) }
  }

  return (
    <Card className={`rounded-2xl ${it.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="size-9 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">{TYPE_ICON[it.type] || <ClipboardList className="size-4" />}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{it.title}</h3>
                {recentlyChanged(it) && <Badge variant="outline" className="text-[9px] border-sky-200 bg-sky-50 text-sky-700">Changed</Badge>}
                <Badge variant="outline" className={`text-[10px] ${ITEM_STATUS_COLORS[it.status] || ""}`}>{it.status.replace(/_/g, " ")}</Badge>
                {it.booking && <Badge variant="outline" className={`text-[10px] ${PAYMENT_COLORS[it.booking.paymentStatus] || ""}`}>Payment: {it.booking.paymentStatus.replace(/_/g, " ")}</Badge>}
              </div>
              {(it.date || it.startTime) && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Clock className="size-3" /> {it.date ? formatDate(it.date) : ""}{it.startTime ? ` · ${it.startTime}${it.endTime ? `–${it.endTime}` : ""}` : ""}</p>}
              {it.location && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="size-3" /> {it.location}</p>}
              {it.description && <p className="text-sm text-muted-foreground mt-1">{it.description}</p>}
              {it.bookingReference && <p className="text-xs text-muted-foreground mt-1">Ref: {it.bookingReference}</p>}
              {it.cost != null && <p className="text-xs mt-1"><span className="font-semibold">{money(it.cost, symbol)}</span>{it.paidByName ? ` · paid by ${it.paidByName}` : ""}</p>}
              {it.assigned.length > 0 && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Users className="size-3" /> {it.assigned.map((a) => a.name || a.userId).join(", ")}</p>}
              {it.notes && <p className="text-[11px] text-muted-foreground mt-1 italic">{it.notes}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {canManage && it.status !== "CANCELLED" && (
              <>
                <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={onEdit}><PenLine className="size-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs text-red-500" onClick={cancel}><XCircle className="size-3.5 mr-1" /> Cancel</Button>
                <Select value={it.status} onValueChange={(v) => setStatus(v || it.status)}><SelectTrigger className="rounded-xl h-7 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent>{["PLANNED", "BOOKED", "CONFIRMED", "COMPLETED"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
              </>
            )}
          </div>
        </div>

        {it.booking && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-2 text-xs space-y-1">
            <p><span className="font-semibold">Booking</span> {it.booking.provider ? `· ${it.booking.provider}` : ""}{it.booking.reference ? ` · Ref ${it.booking.reference}` : ""}{it.booking.bookingDate ? ` · ${formatDate(it.booking.bookingDate)}` : ""}</p>
            <p>Amount {money(it.booking.amount, it.booking.currency || symbol)}{it.booking.cancellationNotes ? ` · ${it.booking.cancellationNotes}` : ""}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {it.booking.documents.map((d) => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline"><FileText className="size-3" /> {d.name}</a>)}
              {canManage && (
                <>
                  <label className="inline-flex items-center gap-1 cursor-pointer text-brand underline"><Bell className="size-3" /> {uploading ? "Uploading..." : "Upload doc"}<input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} /></label>
                  <Select value={it.booking.paymentStatus} onValueChange={(v) => setPayment(it.booking!.id, v || "UNPAID")}><SelectTrigger className="rounded-xl h-6 w-28 text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{PAYMENTS.map((p) => <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AddItemDialog({ open, onOpenChange, circleId, members, initial, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  circleId: string
  members: Array<{ userId: string; name: string }>
  initial: ItineraryItem | null
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit itinerary item" : "Add itinerary item"}</DialogTitle><DialogDescription>Bookings are available for flights, hotels, transport and activities.</DialogDescription></DialogHeader>
        {open && <ItemForm key={String(open) + (initial?.id || "new")} circleId={circleId} members={members} initial={initial} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function ItemForm({ circleId, members, initial, onOpenChange, onSaved }: {
  circleId: string
  members: Array<{ userId: string; name: string }>
  initial: ItineraryItem | null
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [f, setF] = useState<Record<string, any>>({
    type: initial?.type || "FLIGHT", title: initial?.title || "", date: initial?.date ? initial.date.slice(0, 10) : "",
    startTime: initial?.startTime || "", endTime: initial?.endTime || "", location: initial?.location || "",
    description: initial?.description || "", bookingReference: initial?.bookingReference || "",
    cost: initial?.cost != null ? String(initial.cost) : "", notes: initial?.notes || "",
    provider: initial?.booking?.provider || "", ref: initial?.booking?.reference || "", amount: initial?.booking?.amount != null ? String(initial.booking.amount) : "",
  })
  const [assigned, setAssigned] = useState<string[]>(initial?.assigned.map((a) => a.userId) || [])
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!f.title?.trim()) return toast.error("Title is required")
    setSubmitting(true)
    try {
      const isBookingType = BOOKABLE.includes(f.type || "FLIGHT")
      const body: Record<string, any> = {
        type: f.type, title: f.title, date: f.date || null, startTime: f.startTime || null, endTime: f.endTime || null,
        location: f.location || null, description: f.description || null, bookingReference: f.bookingReference || null,
        cost: f.cost ? Number(f.cost) : undefined, notes: f.notes || null, assignedUserIds: assigned,
        booking: isBookingType ? { provider: f.provider || null, reference: f.ref || null, amount: f.amount ? Number(f.amount) : undefined, bookingDate: f.date ? new Date(f.date).toISOString() : null } : undefined,
      }
      const url = initial ? `/api/circles/${circleId}/itinerary/${initial.id}` : `/api/circles/${circleId}/itinerary`
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success(initial ? "Item updated" : "Item added")
      setF({}); setAssigned([]); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Select value={f.type || "FLIGHT"} onValueChange={(v) => setF({ ...f, type: v || "FLIGHT" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Title"><Input value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Date"><Input type="date" value={f.date || ""} onChange={(e) => setF({ ...f, date: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Start time"><Input type="time" value={f.startTime || ""} onChange={(e) => setF({ ...f, startTime: e.target.value })} className="rounded-xl" /></Field>
            <Field label="End time"><Input type="time" value={f.endTime || ""} onChange={(e) => setF({ ...f, endTime: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Location"><Input value={f.location || ""} onChange={(e) => setF({ ...f, location: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Booking / reference #"><Input value={f.bookingReference || ""} onChange={(e) => setF({ ...f, bookingReference: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Cost"><Input type="number" value={f.cost || ""} onChange={(e) => setF({ ...f, cost: e.target.value })} className="rounded-xl" /></Field>
          </div>
          <Field label="Description"><Textarea value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="rounded-xl" rows={2} /></Field>
          <Field label="Assigned members">
            <div className="rounded-xl border p-2 max-h-28 overflow-y-auto grid grid-cols-2 gap-1">
              {members.length === 0 && <p className="col-span-2 text-xs text-muted-foreground p-1">No members listed.</p>}
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-1.5 text-xs py-0.5"><input type="checkbox" checked={assigned.includes(m.userId)} onChange={(e) => setAssigned(e.target.checked ? [...assigned, m.userId] : assigned.filter((x) => x !== m.userId))} /> {m.name}</label>
              ))}
            </div>
          </Field>
          {BOOKABLE.includes(f.type || "FLIGHT") && (
            <div className="grid grid-cols-2 gap-3 bg-muted/20 rounded-xl p-3">
              <Field label="Provider"><Input value={f.provider || ""} onChange={(e) => setF({ ...f, provider: e.target.value })} className="rounded-xl" /></Field>
              <Field label="Confirmation / reference"><Input value={f.ref || ""} onChange={(e) => setF({ ...f, ref: e.target.value })} className="rounded-xl" /></Field>
              <Field label="Booking amount"><Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: e.target.value })} className="rounded-xl" /></Field>
            </div>
          )}
          <Field label="Notes"><Textarea value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} className="rounded-xl" rows={2} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}