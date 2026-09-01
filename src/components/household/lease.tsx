"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  KeyRound, ArrowLeft, Plus, Upload, Users, Clock, Home as HomeIcon, ShieldAlert,
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
import { CURRENCIES } from "@/lib/constants"

function money(n: number, code: string): string {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

type Room = { id: string; name: string; rentShare: number | null; depositShare: number | null; capacity: number; notes: string | null; occupantId: string | null; vacant: boolean }
type Deposit = { memberId: string; memberName: string; expected: number; paid: number; deductions: number; refundDue: number; refundPaid: number; status: string; paidProofUrl: string | null; refundProofUrl: string | null }

export function Lease({ circleId, circleName, currency, canManage }: { circleId: string; circleName: string; currency: string; canManage: boolean }) {
  const [data, setData] = useState<any>(null)
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showLease, setShowLease] = useState(false)
  const [showRoom, setShowRoom] = useState(false)
  const [assignRoom, setAssignRoom] = useState<Room | null>(null)
  const [payFor, setPayFor] = useState<Deposit | null>(null)
  const symbol = currency || "ZAR"

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [l, m] = await Promise.all([
          fetch(`/api/circles/${circleId}/household/lease`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/circles/${circleId}/members`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        ])
        if (!cancelled && l) {
          setData(l)
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
  if (!data) return <Card className="rounded-2xl"><CardContent className="py-14 text-center"><p className="font-medium">Could not load lease details</p></CardContent></Card>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`${base}/household`} />} variant="outline" size="icon-sm" className="rounded-xl shrink-0"><ArrowLeft className="size-4" /></Button>
            <h1 className="text-xl font-bold tracking-tight">Lease, Rooms & Deposits</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{circleName} — occupancy and deposit tracking</p>
        </div>
        {canManage && <div className="flex items-center gap-2 shrink-0"><Button variant="outline" className="rounded-xl h-8" onClick={() => setShowLease(true)}>Lease details</Button><Button variant="outline" className="rounded-xl h-8" onClick={() => setShowRoom(true)}><Plus className="size-3.5 mr-1" /> Room</Button></div>}
      </div>

      <div className="space-y-1.5">
        {(data.alerts || []).map((a: any) => (
          <div key={a.id} className={`flex gap-2 text-sm p-3 rounded-xl border ${a.level === "risk" ? "border-red-200 bg-red-50/50 text-red-800" : a.level === "warning" ? "border-amber-200 bg-amber-50/50 text-amber-800" : "border-sky-200 bg-sky-50/40 text-sky-800"}`}><ShieldAlert className="size-4 shrink-0 mt-0.5" /><div className="min-w-0"><p className="font-medium">{a.title}</p><p className="text-xs opacity-80">{a.description}</p></div></div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<KeyRound className="size-4" />} label="Lease" value={data.lease ? data.lease.status : "Not configured"} tone={data.leaseStatus === "EXPIRING" ? "text-amber-600" : data.leaseStatus === "ENDED" ? "text-red-500" : ""} sub={data.daysLeft != null ? `${data.daysLeft} days left` : ""} />
        <Widget icon={<HomeIcon className="size-4" />} label="Rooms occupied" value={`${data.vacantRooms != null ? data.rooms.length - data.vacantRooms : 0}/${data.rooms.length}`} />
        <Widget icon={<HomeIcon className="size-4" />} label="Vacant rooms" value={String(data.vacantRooms ?? 0)} tone={(data.vacantRooms ?? 0) > 0 ? "text-amber-600" : ""} />
        <Widget icon={<Clock className="size-4" />} label="My room" value={data.my?.room?.roomName ?? "—"} sub={data.my?.rentShare ? `share ${money(data.my.rentShare, symbol)}` : ""} />
        <Widget icon={<HomeIcon className="size-4" />} label="My deposit" value={data.my?.deposit?.status ?? "—"} tone={data.my?.deposit?.status === "PENDING" ? "text-amber-600" : ""} />
        <Widget icon={<Users className="size-4" />} label="Move-outs (30d)" value={String(data.upcomingMoveOuts?.length ?? 0)} tone={(data.upcomingMoveOuts?.length || 0) > 0 ? "text-amber-600" : ""} />
        <Widget icon={<KeyRound className="size-4" />} label="Refunds due" value={String(data.refundsDue?.length ?? 0)} tone={(data.refundsDue?.length || 0) > 0 ? "text-emerald-600" : ""} />
        <div className="rounded-2xl border p-3 flex items-center"><p className="text-[10px] text-muted-foreground">{data.occupancyHistoryCount || 0} occupancy records kept (history never rewritten)</p></div>
      </div>

      {/* Rooms */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HomeIcon className="size-4" /> Rooms</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.rooms.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No rooms yet. Create rooms and assign members.</p> : data.rooms.map((r: Room) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border px-3 py-2">
              <div className="min-w-0"><p className="font-medium truncate">{r.name}</p><div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">{r.rentShare != null && <span>rent {money(r.rentShare, symbol)}</span>}{r.depositShare != null && <span>deposit {money(r.depositShare, symbol)}</span>}<span>{r.capacity} cap</span>{r.vacant && <Badge variant="outline" className="text-[9px] border-amber-200 bg-amber-50 text-amber-700">Vacant</Badge>}</div></div>
              <div className="flex items-center gap-2 shrink-0">{canManage && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => setAssignRoom(r)}><Users className="size-3 mr-1" /> {r.vacant ? "Assign" : "Change"}</Button>}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Deposits */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="size-4" /> Deposits</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.deposits.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">No deposits recorded.</p> : data.deposits.map((d: Deposit) => (
            <div key={d.memberId} className="flex items-center justify-between gap-2 text-sm rounded-lg border px-3 py-2 flex-wrap">
              <div className="min-w-0"><p className="font-medium truncate">{d.memberName}</p><div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap"><span>paid {money(d.paid, symbol)} / {money(d.expected, symbol)}</span><span className={d.refundDue > d.refundPaid ? "text-emerald-600" : ""}>refund due {money(d.refundDue - d.refundPaid, symbol)}</span></div></div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[9px] ${d.status === "REFUNDED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : d.status === "PAID" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{d.status.replace(/_/g, " ")}</Badge>
                {d.paidProofUrl && <a href={d.paidProofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline">paid proof</a>}
                {d.refundProofUrl && <a href={d.refundProofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline">refund proof</a>}
                <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={() => setPayFor(d)}>Manage</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <LeaseDialog open={showLease} onOpenChange={setShowLease} circleId={circleId} data={data.lease} onSaved={refresh} />
      <RoomDialog open={showRoom} onOpenChange={setShowRoom} circleId={circleId} onSaved={refresh} />
      <AssignDialog room={assignRoom} circleId={circleId} members={members} onClose={() => setAssignRoom(null)} onSaved={() => { refresh(); setAssignRoom(null) }} />
      <DepositDialog dep={payFor} circleId={circleId} symbol={symbol} canManage={canManage} onClose={() => setPayFor(null)} onSaved={() => { refresh(); setPayFor(null) }} />
    </div>
  )
}

function Widget({ icon, label, value, sub, tone = "" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div><p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{value}</p>{sub && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>}</CardContent></Card>
}

function LeaseDialog({ open, onOpenChange, circleId, data, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; data: any | null; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Lease details</DialogTitle><DialogDescription>Lease dates, landlord, rent, deposit and document.</DialogDescription></DialogHeader>
        {open && <LeaseForm key={String(open)} circleId={circleId} data={data} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function LeaseForm({ circleId, data, onOpenChange, onSaved }: { circleId: string; data: any | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({
    leaseStart: data?.leaseStart ? data.leaseStart.slice(0, 10) : "", leaseEnd: data?.leaseEnd ? data.leaseEnd.slice(0, 10) : "",
    landlordAgent: data?.landlordAgent || "", monthlyRent: data?.monthlyRent ? String(data.monthlyRent) : "", depositTotal: data?.depositTotal ? String(data.depositTotal) : "",
    noticePeriodDays: data?.noticePeriodDays ? String(data.noticePeriodDays) : "", renewalDate: data?.renewalDate ? data.renewalDate.slice(0, 10) : "", status: data?.status || "DRAFT",
  })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/lease`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        leaseStart: f.leaseStart || null, leaseEnd: f.leaseEnd || null, landlordAgent: f.landlordAgent || null,
        monthlyRent: f.monthlyRent ? Number(f.monthlyRent) : null, depositTotal: f.depositTotal ? Number(f.depositTotal) : null,
        noticePeriodDays: f.noticePeriodDays ? Number(f.noticePeriodDays) : null, renewalDate: f.renewalDate || null, status: f.status,
      }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Lease saved"); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lease start"><Input type="date" value={f.leaseStart || ""} onChange={(e) => setF({ ...f, leaseStart: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Lease end"><Input type="date" value={f.leaseEnd || ""} onChange={(e) => setF({ ...f, leaseEnd: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Landlord / agent"><Input value={f.landlordAgent || ""} onChange={(e) => setF({ ...f, landlordAgent: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Monthly rent"><Input type="number" value={f.monthlyRent || ""} onChange={(e) => setF({ ...f, monthlyRent: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Deposit total"><Input type="number" value={f.depositTotal || ""} onChange={(e) => setF({ ...f, depositTotal: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Notice period (days)"><Input type="number" value={f.noticePeriodDays || ""} onChange={(e) => setF({ ...f, noticePeriodDays: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Renewal date"><Input type="date" value={f.renewalDate || ""} onChange={(e) => setF({ ...f, renewalDate: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Status"><Select value={f.status || "DRAFT"} onValueChange={(v) => setF({ ...f, status: v || "DRAFT" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["DRAFT", "ACTIVE", "EXPIRING", "ENDED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save lease"}</Button>
      </DialogFooter>
    </div>
  )
}

function RoomDialog({ open, onOpenChange, circleId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add room</DialogTitle></DialogHeader>
        {open && <RoomForm key={String(open)} circleId={circleId} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}
function RoomForm({ circleId, onOpenChange, onSaved }: { circleId: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ name: "", rentShare: "", depositShare: "", capacity: "1" })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!f.name?.trim()) return toast.error("Room name required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, monthlyRentShare: f.rentShare ? Number(f.rentShare) : null, depositShare: f.depositShare ? Number(f.depositShare) : null, capacity: Number(f.capacity) || 1 }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Room created"); setF({}); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name / number"><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Rent share"><Input type="number" value={f.rentShare || ""} onChange={(e) => setF({ ...f, rentShare: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Deposit share"><Input type="number" value={f.depositShare || ""} onChange={(e) => setF({ ...f, depositShare: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Capacity"><Input type="number" value={f.capacity || "1"} onChange={(e) => setF({ ...f, capacity: e.target.value })} className="rounded-xl" /></Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">Add room</Button>
      </DialogFooter>
    </div>
  )
}

function AssignDialog({ room, circleId, members, onClose, onSaved }: { room: Room | null; circleId: string; members: Array<{ userId: string; name: string }>; onClose: () => void; onSaved: () => void }) {
  const [memberId, setMemberId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!room || !memberId) return toast.error("Choose a member")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/household/rooms/${room.id}/occupancy?action=assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Room assigned"); setMemberId(""); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!room} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Assign {room?.name}</DialogTitle><DialogDescription>Prior occupancy is closed (history preserved).</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Member"><Select value={memberId} onValueChange={(v) => setMemberId(v || "")}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Assigning..." : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DepositDialog({ dep, circleId, symbol, canManage, onClose, onSaved }: { dep: Deposit | null; circleId: string; symbol: string; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("")
  const [deductions, setDeductions] = useState("")
  const [proof, setProof] = useState<File | null>(null)
  const [action, setAction] = useState("paid")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!dep) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      if (amount) fd.append("amount", String(Number(amount)))
      if (deductions && action === "finalize") fd.append("deductions", String(Number(deductions)))
      if (proof) fd.append("file", proof)
      const r = await fetch(`/api/circles/${circleId}/household/deposits/${dep.memberId}?action=${action}`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Deposit updated"); setAmount(""); setProof(null); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!dep} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Deposit: {dep?.memberName}</DialogTitle><DialogDescription>Paid {money(dep?.paid || 0, symbol)} / {money(dep?.expected || 0, symbol)} · refund due {money(dep ? dep.refundDue - dep.refundPaid : 0, symbol)}.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Action"><Select value={action} onValueChange={(v) => setAction(v || "paid")}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paid">Record payment</SelectItem><SelectItem value="finalize">Finalize (deductions)</SelectItem><SelectItem value="refund">Record refund</SelectItem></SelectContent></Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" /></Field>
            {action === "finalize" && canManage && <Field label="Deductions"><Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} className="rounded-xl" /></Field>}
          </div>
          {action !== "finalize" && <Field label="Proof (optional)"><label className="flex items-center gap-2 rounded-xl border border-dashed p-2 cursor-pointer hover:bg-muted/40 text-sm truncate"><Upload className="size-4 shrink-0 text-brand" /><span className="truncate">{proof ? proof.name : "Upload proof"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setProof(e.target.files?.[0] || null)} /></label></Field>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting || (action === "finalize" && !canManage)} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}