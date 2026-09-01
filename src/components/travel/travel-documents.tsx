"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText, ArrowLeft, Plus, Upload, Trash2, ShieldAlert, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatDate } from "@/components/projects/types"

const DOC_TYPES = ["PASSPORT", "VISA", "FLIGHT_TICKET", "HOTEL_CONFIRMATION", "TRAVEL_INSURANCE", "BOOKING_CONFIRMATION", "VACCINATION_HEALTH", "OTHER"]
const EXPIRABLE = ["PASSPORT", "VISA"]
const EXPIRY_WINDOW_MS = 60 * 86400000
const NOW_MS = Date.now()

type DocRow = { id: string; type: string; name: string | null; url: string; expiryDate: string | null; relatedItemId: string | null; notes: string | null; createdAt: string }

export function TravelDocuments({ circleId, circleName, canManage }: {
  circleId: string
  circleName: string
  canManage: boolean
}) {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [alerts, setAlerts] = useState<{ missing: string[]; expiring: Array<{ type: string; days: number }> }>({ missing: [], expiring: [] })
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/travel/documents`)
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) {
          setDocs(j.myDocuments || [])
          setAlerts(j.myAlerts || { missing: [], expiring: [] })
          const mlist = j.memberDocCounts || []
          if (canManage) setMembers(mlist.map((m: any) => ({ userId: m.userId, name: m.name })))
        }
      } catch { /* keep */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey, canManage])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }
  const base = `/circles/${circleId}`

  const del = async (id: string) => {
    const r = await fetch(`/api/circles/${circleId}/travel/documents/${id}`, { method: "DELETE" })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Document deleted"); refresh()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>)}</div></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`${base}/trip`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Travel Documents</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} — private documents. Only you can see your files.</p>
        </div>
        <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowAdd(true)}><Plus className="size-4 mr-1" /> Upload</Button>
      </div>

      {(alerts.missing.length > 0 || alerts.expiring.length > 0) && (
        <div className="space-y-1.5">
          {alerts.missing.map((t) => <div key={t} className="flex gap-2 text-sm p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-800"><ShieldAlert className="size-4 shrink-0 mt-0.5" /><span>Missing required document: {t.replace(/_/g, " ")}</span></div>)}
          {alerts.expiring.map((e) => <div key={e.type} className="flex gap-2 text-sm p-3 rounded-xl border border-red-200 bg-red-50/50 text-red-800"><ShieldAlert className="size-4 shrink-0 mt-0.5" /><span>Your {e.type.replace(/_/g, " ")} expires in {e.days} day(s)</span></div>)}
        </div>
      )}

      {docs.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-14 text-center"><FileText className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No documents yet</p><p className="text-sm text-muted-foreground mt-1">Upload your passport, visa, tickets, insurance and confirmations.</p><Button className="mt-4 rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowAdd(true)}><Upload className="size-4 mr-1" /> Upload first document</Button></CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Card key={d.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{d.name || d.type.replace(/_/g, " ")}</p>
                    <Badge variant="outline" className="text-[9px] mt-1">{d.type.replace(/_/g, " ")}</Badge>
                  </div>
                  <Button size="icon-sm" variant="ghost" className="rounded-lg text-red-500 shrink-0" onClick={() => del(d.id)}><Trash2 className="size-4" /></Button>
                </div>
                {d.expiryDate && EXPIRABLE.includes(d.type) && <p className={`text-[11px] mt-2 ${new Date(d.expiryDate).getTime() - NOW_MS < EXPIRY_WINDOW_MS ? "text-red-500 font-medium" : "text-muted-foreground"}`}>Expires {formatDate(d.expiryDate)}</p>}
                {d.notes && <p className="text-[11px] text-muted-foreground mt-1">{d.notes}</p>}
                <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand underline mt-3"><CheckCircle2 className="size-3" /> Open document</a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canManage && members.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Member document readiness</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 text-sm rounded-lg border px-3 py-2">
                <span className="font-medium min-w-0 truncate">{m.name}</span>
                <ShieldAlert className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground">manage their own documents</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AddDocDialog open={showAdd} onOpenChange={setShowAdd} circleId={circleId} members={members} canManage={canManage} onSaved={refresh} />
    </div>
  )
}

function AddDocDialog({ open, onOpenChange, circleId, members, canManage, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Array<{ userId: string; name: string }>; canManage: boolean; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Upload travel document</DialogTitle><DialogDescription>Stored privately — only the owner (and, if permitted, organizers) can view it.</DialogDescription></DialogHeader>
        {open && <AddDocForm key={String(open)} circleId={circleId} members={members} canManage={canManage} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function AddDocForm({ circleId, members, canManage, onOpenChange, onSaved }: { circleId: string; members: Array<{ userId: string; name: string }>; canManage: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [type, setType] = useState("PASSPORT")
  const [expiryDate, setExpiryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [ownerUserId, setOwnerUserId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!file) return toast.error("Choose a file")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", type)
      if (expiryDate) fd.append("expiryDate", new Date(expiryDate).toISOString())
      if (notes.trim()) fd.append("notes", notes.trim())
      if (canManage && ownerUserId) fd.append("ownerUserId", ownerUserId)
      const r = await fetch(`/api/circles/${circleId}/travel/documents`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Document uploaded")
      setFile(null); setType("PASSPORT"); setExpiryDate(""); setNotes(""); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={type} onValueChange={(v) => setType(v || "PASSPORT")}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        {canManage && members.length > 0 && <Field label="Owner (managers)"><Select value={ownerUserId} onValueChange={(v) => setOwnerUserId(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="You" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>}
        <Field label="Expiry (optional)"><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="rounded-xl" /></Field>
        <Field label="File"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Choose file (max 5MB)"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
      </div>
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" rows={2} /></Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Uploading..." : "Upload"}</Button>
      </DialogFooter>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}