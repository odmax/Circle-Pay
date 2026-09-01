"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ClipboardCheck, ArrowLeft, Plus, Upload, CheckCircle2, Users, Clock, RefreshCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatDate } from "@/components/projects/types"

const CATS = ["CLEANING", "DISHES", "TRASH", "BATHROOM", "KITCHEN", "LAUNDRY", "SHOPPING", "GARDEN", "PET_CARE", "CUSTOM"]
const FREQS = ["ONCE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]
const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "border-slate-200 bg-slate-50 text-slate-600",
  DUE: "border-amber-200 bg-amber-50 text-amber-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SKIPPED: "border-purple-200 bg-purple-50 text-purple-700",
}

type Chore = { id: string; title: string; description: string | null; category: string; assigneeId: string | null; assigneeName: string | null; dueDate: string | null; dueTime: string | null; status: string; points: number; completedByName: string | null; completionNote: string | null; proofUrl: string | null; isMine: boolean }
type Template = { id: string; title: string; category: string; frequency: string; dueTime: string | null; rotationType: string; active: boolean; archived: boolean }

export function Chores({ circleId, circleName, canManage }: {
  circleId: string
  circleName: string
  canManage: boolean
}) {
  const [data, setData] = useState<any>(null)
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [completing, setCompleting] = useState<Chore | null>(null)
  const [swapping, setSwapping] = useState<Chore | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [c, m] = await Promise.all([
          fetch(`/api/circles/${circleId}/household/chores`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/circles/${circleId}/members`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        ])
        if (!cancelled && c) {
          setData(c)
          const mlist = Array.isArray(m) ? m : m.members || []
          setMembers(mlist.filter((x: any) => x.userId || x.id).map((x: any) => ({ userId: x.userId || x.id, name: x.name || x.user?.name || x.userId })))
        }
      } catch { /* keep */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }
  const base = `/circles/${circleId}`

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</CardContent></Card></div>
  if (!data) return <Card className="rounded-2xl"><CardContent className="py-14 text-center"><p className="font-medium">Could not load chores</p></CardContent></Card>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`${base}/household`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Chores & Responsibilities</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} — shared housework, done fairly</p>
        </div>
        {canManage && <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> New chore template</Button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<ClipboardCheck className="size-4" />} label="My chores today" value={String(data.today.filter((c: Chore) => c.isMine).length)} />
        <Widget icon={<Users className="size-4" />} label="Household chores today" value={String(data.today.length)} />
        <Widget icon={<Clock className="size-4" />} label="Completed this week" value={String(data.completedThisWeek)} />
        <Widget icon={<Clock className="size-4" />} label="Overdue chores" value={String(data.overdue.length)} tone={data.overdue.length > 0 ? "text-red-500" : ""} />
        <Widget icon={<ClipboardCheck className="size-4" />} label="Household completion" value={`${data.completionPct}%`} />
        <Widget icon={<Clock className="size-4" />} label="Next responsibility" value={data.nextResponsibility ? data.nextResponsibility.title : "—"} sub={data.nextResponsibility ? `${data.nextResponsibility.status.toLowerCase()} · ${data.nextResponsibility.dueDate ? formatDate(data.nextResponsibility.dueDate) : ""}${data.nextResponsibility.isMine ? " · yours" : ""}` : ""} />
      </div>

      {/* My chores */}
      <Card className="rounded-2xl border-brand/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="size-4" /> My chores</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.mine.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">You have no assigned chores.</p> : data.mine.map((c: Chore) => (
            <ChoreRow key={c.id} c={c}  onComplete={() => setCompleting(c)} onSwap={() => setSwapping(c)} />
          ))}
        </CardContent>
      </Card>

      {/* All/household chores */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="size-4" /> Household chores</CardTitle></CardHeader>
        <CardContent>
          {data.chores.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No chores yet. Add a template to distribute housework.</p> : (
            <div className="grid gap-1.5 lg:grid-cols-2">
              {data.chores.map((c: Chore) => <ChoreRow key={c.id} c={c}  onComplete={c.isMine ? () => setCompleting(c) : undefined} onSwap={c.isMine ? () => setSwapping(c) : undefined} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fairness */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="size-4" /> Responsibility fairness</CardTitle>
          {data.uneven && <Badge className="text-[9px] bg-amber-500 text-white border-0">Uneven workload</Badge>}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-[11px] text-muted-foreground border-b"><th className="py-1.5 pr-3">Member</th><th className="py-1.5 pr-3">Assigned</th><th className="py-1.5 pr-3">Completed</th><th className="py-1.5 pr-3">Overdue</th><th className="py-1.5">%</th></tr></thead>
            <tbody>
              {data.fairness.map((f: any) => (
                <tr key={f.userId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{f.name}</td>
                  <td className="py-2 pr-3">{f.assigned}</td>
                  <td className="py-2 pr-3">{f.completed}</td>
                  <td className="py-2 pr-3">{f.overdue > 0 && <span className="text-red-500">{f.overdue}</span>}</td>
                  <td className="py-2">{f.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Templates (admin) */}
      {canManage && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Chore templates</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.templates.length === 0 ? <p className="text-sm text-muted-foreground py-2 text-center">No templates yet.</p> : data.templates.map((t: Template) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border px-3 py-2">
                <span className="min-w-0 truncate">{t.title}</span>
                <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{t.category.replace(/_/g, " ")}</Badge>
                  <span>{t.frequency.toLowerCase()}</span>
                  <span>{t.rotationType.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className={`text-[9px] ${t.active && !t.archived ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{t.archived ? "Archived" : t.active ? "Active" : "Paused"}</Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CreateTemplateDialog open={showCreate} onOpenChange={setShowCreate} circleId={circleId} members={members} onSaved={() => { refresh(); setShowCreate(false) }} />
      <CompleteDialog chore={completing} circleId={circleId} onClose={() => setCompleting(null)} onDone={refresh} />
      <SwapDialog chore={swapping} circleId={circleId} members={members} onClose={() => setSwapping(null)} onDone={refresh} />
    </div>
  )
}

function ChoreRow({ c, onComplete, onSwap }: { c: Chore; onComplete?: () => void; onSwap?: () => void }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${c.status === "COMPLETED" || c.status === "SKIPPED" ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-medium truncate">{c.title}</p>
          <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[9px]">{c.category.replace(/_/g, " ")}</Badge>
            <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[c.status] || ""}`}>{c.status.toLowerCase()}</Badge>
            {c.dueDate && <span>due {formatDate(c.dueDate)}{c.dueTime ? ` ${c.dueTime}` : ""}</span>}
            {c.assigneeName && <span>· {c.assigneeName}</span>}
            {c.points > 0 && <span>· pts {c.points}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.status === "COMPLETED" && c.completedByName && <span className="text-[10px] text-muted-foreground">done by {c.completedByName}</span>}
          {c.isMine && c.status !== "COMPLETED" && c.status !== "SKIPPED" && (
            <>
              {onComplete && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs text-emerald-600" onClick={onComplete}><CheckCircle2 className="size-3 mr-1" /> Complete</Button>}
              {onSwap && <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={onSwap}><RefreshCcw className="size-3 mr-1" /> Swap</Button>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Widget({ icon, label, value, sub, tone = "" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{value}</p>{sub && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>}</CardContent></Card>
}

function CreateTemplateDialog({ open, onOpenChange, circleId, members, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; members: Array<{ userId: string; name: string }>; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New chore template</DialogTitle><DialogDescription>Assign or configure rotation — recurrence generates instances idempotently.</DialogDescription></DialogHeader>
        {open && <CreateTemplateForm key={String(open)} circleId={circleId} members={members} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function CreateTemplateForm({ circleId, members, onOpenChange, onSaved }: { circleId: string; members: Array<{ userId: string; name: string }>; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ title: "", category: "CLEANING", frequency: "WEEKLY", dueTime: "18:00", rotationType: "FIXED" })
  const [rotation, setRotation] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!f.title?.trim()) return toast.error("Title required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/chores`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: f.title, category: f.category, frequency: f.frequency, dueTime: f.dueTime || "18:00", priority: Number(f.priority) || 0, points: Number(f.points) || 0,
        rotationType: f.rotationType, rotationMembers: f.rotationType === "ROUND_ROBIN" ? rotation : null, assigneeIds: f.rotationType === "ROUND_ROBIN" ? null : rotation,
      }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Chore template created"); setF({}); setRotation([]); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><Input value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Category"><Select value={f.category || "CLEANING"} onValueChange={(v) => setF({ ...f, category: v || "CLEANING" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Frequency"><Select value={f.frequency || "WEEKLY"} onValueChange={(v) => setF({ ...f, frequency: v || "WEEKLY" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{FREQS.map((x) => <SelectItem key={x} value={x}>{x.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Due time"><Input type="time" value={f.dueTime || "18:00"} onChange={(e) => setF({ ...f, dueTime: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Assignment"><Select value={f.rotationType || "FIXED"} onValueChange={(v) => setF({ ...f, rotationType: v || "FIXED" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIXED">Fixed</SelectItem><SelectItem value="ROUND_ROBIN">Round robin</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent></Select></Field>
        <Field label="Points (optional)"><Input type="number" value={f.points || ""} onChange={(e) => setF({ ...f, points: e.target.value })} className="rounded-xl" /></Field>
      </div>
      <Field label={f.rotationType === "ROUND_ROBIN" ? "Rotation members (order counts)" : "Members"}>
        <div className="rounded-xl border p-2 max-h-28 overflow-y-auto grid grid-cols-2 gap-1">
          {members.length === 0 && <p className="col-span-2 text-xs text-muted-foreground p-1">No members listed.</p>}
          {members.map((m, i) => (
            <label key={m.userId} className="flex items-center gap-1.5 text-xs py-0.5"><input type="checkbox" checked={rotation.includes(m.userId)} onChange={(e) => setRotation(e.target.checked ? [...rotation, m.userId] : rotation.filter((x) => x !== m.userId))} /> {i + 1}. {m.name}</label>
          ))}
        </div>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Creating..." : "Create"}</Button>
      </DialogFooter>
    </div>
  )
}

function CompleteDialog({ chore, circleId, onClose, onDone }: { chore: Chore | null; circleId: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!chore) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      if (note.trim()) fd.append("note", note.trim())
      if (file) fd.append("file", file)
      const r = await fetch(`/api/circles/${circleId}/household/chores/instances/${chore.id}?action=complete`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Chore completed"); setNote(""); setFile(null); onDone(); onClose()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!chore} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Complete: {chore?.title}</DialogTitle><DialogDescription>Optional note + proof photo.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" /></Field>
          <Field label="Proof (optional)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{file ? file.name : "Upload photo"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Complete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SwapDialog({ chore, circleId, members, onClose, onDone }: { chore: Chore | null; circleId: string; members: Array<{ userId: string; name: string }>; onClose: () => void; onDone: () => void }) {
  const [toUserId, setToUserId] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!chore || !toUserId) return toast.error("Choose a member to receive the chore")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/chores/instances/${chore.id}?action=swap-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUserId, note: note || undefined }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Swap requested — pending approval"); setToUserId(""); setNote(""); onDone(); onClose()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!chore} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Request swap: {chore?.title}</DialogTitle><DialogDescription>The receiving member or a manager approves the swap.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Give to"><Select value={toUserId} onValueChange={(v) => setToUserId(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select member" /></SelectTrigger><SelectContent>{members.filter((m) => m.userId !== chore?.assigneeId).map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Requesting..." : "Request swap"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}