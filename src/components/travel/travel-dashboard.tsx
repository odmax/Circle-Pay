"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Plane, MapPin, Calendar, Wallet, CircleDollarSign, PiggyBank, TrendingDown,
  Users, Clock, Megaphone, AlertTriangle, MessageCircle, Vote,
  ArrowUpRight, Settings2, BellRing, ShieldAlert, Info, Compass,
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
import { CURRENCIES } from "@/lib/constants"

interface TravelTripData {
  trip: {
    id: string; name: string; destination: string | null; startDate: string | null; endDate: string | null;
    currency: string; totalBudget: number; contributionTarget: number; status: string;
    coverImage: string | null; meetingPoint: string | null; emergencyContact: string | null; notes: string | null;
  } | null
  countdown: { daysToStart: number; daysLeft: number; inProgress: boolean; completed: boolean; label: string }
  budget: { collected: number; spent: number; remaining: number; collectionPct: number; budgetUsedPct: number; budgetRemainingPct: number; membersPaid: number; membersOutstanding: number }
  my: { myShareTarget: number; myOutstanding: number; myTripBalance: number; myStatus: string }
  deadlines: Array<{ id: string; name: string; amount: number; dueDate: string | null }>
  events: Array<{ id: string; title: string; description: string | null; startAt: string; isOnline: boolean; myRsvp: string | null }>
  polls: Array<{ id: string; title: string; closesAt: string | null; myVoted: boolean }>
  activity: Array<{ id: string; title: string | null; content: string; createdAt: string; authorName: string | null }>
  alerts: Array<{ id: string; level: string; title: string; description: string }>
  memberCount: number
  membersPaid: number
  itinerary: {
    todayOrNext: { id: string; title: string; type: string; date: string | null; startTime: string | null } | null
    nextFlight: { id: string; title: string; date: string | null; startTime: string | null } | null
    hotel: { id: string; title: string; date: string | null } | null
    nextActivity: { id: string; title: string; date: string | null; startTime: string | null } | null
    bookingCompletionPct: number
    missingBookingsCount: number
    missingDocumentsCount: number
  }
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE: "border-brand-200 bg-brand-50 text-brand-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}
const STATUSES = ["PLANNING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"]

function money(n: number, code: string): string {
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? code
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function TravelDashboard({ circleId, circleName, currency, canManage }: {
  circleId: string
  circleName: string
  currency: string
  canManage: boolean
}) {
  const [data, setData] = useState<TravelTripData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [showSetup, setShowSetup] = useState(false)
  const [reminding, setReminding] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/travel`)
        if (!r.ok) throw new Error("Failed to load trip")
        const j = await r.json()
        if (!cancelled) setData(j)
      } catch {
        if (!cancelled) setData(null as unknown as TravelTripData)
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, reloadKey])

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }

  const setStatus = async (status: string) => {
    const r = await fetch(`/api/circles/${circleId}/travel?action=status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Failed"); return }
    toast.success("Trip status updated"); refresh()
  }

  const sendReminders = async () => {
    setReminding(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/travel/remind`, { method: "POST" })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Reminders sent to outstanding members")
    } catch (e) { toast.error((e as Error).message) } finally { setReminding(false) }
  }

  if (loading) return <TravelSkeleton />

  if (!data || !data.trip) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trip</h1>
            <p className="text-muted-foreground">{circleName} — plan and fund your group trip</p>
          </div>
        </div>
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Plane className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Trip not configured yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Set up the destination, dates and budget so everyone can start contributing.</p>
            {canManage ? (
              <Button className="mt-4 rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowSetup(true)}>
                <Settings2 className="size-4 mr-1" /> Set up trip
              </Button>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Only organizers can configure this trip.</p>
            )}
          </CardContent>
        </Card>
        <SetupTripDialog open={showSetup} onOpenChange={setShowSetup} circleId={circleId} currency={currency} onSaved={refresh} />
      </div>
    )
  }

  const t = data.trip
  const symbol = t.currency || "ZAR"
  const base = `/circles/${circleId}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{t.name}</h1>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[t.status] || ""}`}>{t.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
            <MapPin className="size-3.5" /> {t.destination || "No destination set"} · <Compass className="size-3.5" /> {circleName}
          </p>
          {t.meetingPoint && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Plane className="size-3.5" /> Departure: {t.meetingPoint}</p>}
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button variant="outline" className="rounded-xl h-8" onClick={() => setShowSetup(true)}><Settings2 className="size-3.5 mr-1" /> Edit trip</Button>
            <Select value={t.status} onValueChange={(v) => setStatus(v || t.status)}><SelectTrigger className="rounded-xl h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
          </div>
        )}
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-1.5">
          {data.alerts.map((a) => (
            <div key={a.id} className={`flex gap-3 text-sm p-3 rounded-xl border ${a.level === "risk" ? "border-red-200 bg-red-50/50 text-red-800" : a.level === "warning" ? "border-amber-200 bg-amber-50/50 text-amber-800" : "border-sky-200 bg-sky-50/40 text-sky-800"}`}>
              {a.level === "risk" ? <ShieldAlert className="size-4 shrink-0 mt-0.5" /> : a.level === "warning" ? <AlertTriangle className="size-4 shrink-0 mt-0.5" /> : <Info className="size-4 shrink-0 mt-0.5" />}
              <div className="min-w-0"><p className="font-medium">{a.title}</p><p className="text-xs opacity-80">{a.description}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget icon={<Calendar className="size-4" />} label="Trip Countdown" value={data.countdown.label} />
        <Widget icon={<Wallet className="size-4" />} label="Collected" value={`${money(data.budget.collected, symbol)} · ${data.budget.collectionPct}%`} />
        <Widget icon={<TrendingDown className="size-4" />} label="Budget Used" value={`${money(data.budget.spent, symbol)} · ${data.budget.budgetUsedPct}%`} />
        <Widget icon={<PiggyBank className="size-4" />} label="Remaining" value={money(data.budget.remaining, symbol)} tone={data.budget.remaining < 0 ? "text-red-500" : ""} />
      </div>

      {/* Contribution progress + members */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Contribution Progress</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <BarBar label="Collected" pct={data.budget.collectionPct} sub={`${money(data.budget.collected, symbol)} of ${t.contributionTarget > 0 ? money(t.contributionTarget, symbol) : "no target"}`} />
            <BarBar label="Budget used" pct={data.budget.budgetUsedPct} sub={`${money(data.budget.spent, symbol)} of ${t.totalBudget > 0 ? money(t.totalBudget, symbol) : "no budget"}`} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="size-4" /> Members</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Mini label="Paid" value={`${data.budget.membersPaid}/${data.memberCount}`} tone="text-emerald-600" />
              <Mini label="Outstanding" value={String(data.budget.membersOutstanding)} tone={data.budget.membersOutstanding > 0 ? "text-amber-600" : "text-emerald-600"} />
            </div>
            {canManage && data.budget.membersOutstanding > 0 && (
              <Button size="sm" variant="outline" className="rounded-xl h-8 mt-3" onClick={sendReminders} disabled={reminding}>
                <BellRing className="size-3.5 mr-1" /> {reminding ? "Sending..." : "Remind outstanding members"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My trip position */}
      <Card className="rounded-2xl border-brand/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2"><CircleDollarSign className="size-4 text-brand" /><h3 className="font-semibold">My Trip Position</h3></div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button render={<Link href={`${base}/contributions`} />} variant="outline" size="sm" className="rounded-xl h-8"><ArrowUpRight className="size-3.5 mr-1" /> Contribute / upload proof</Button>
              <Button render={<Link href={`${base}/expenses`} />} variant="outline" size="sm" className="rounded-xl h-8"><TrendingDown className="size-3.5 mr-1" /> Expenses</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 mt-4 gap-3">
            <Mini label="Status" value={data.my.myStatus} />
            <Mini label="My share target" value={money(data.my.myShareTarget, symbol)} />
            <Mini label="My outstanding" value={money(data.my.myOutstanding, symbol)} tone={data.my.myOutstanding > 0 ? "text-amber-600" : "text-emerald-600"} />
            <Mini label="My trip balance" value={money(data.my.myTripBalance, symbol)} tone={data.my.myTripBalance >= 0 ? "text-emerald-600" : "text-red-500"} />
          </div>
        </CardContent>
      </Card>

      {/* Deadlines + next activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="size-4" /> Upcoming Deadlines</CardTitle></CardHeader>
          <CardContent>
            {data.deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No contribution schedule yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.deadlines.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                    <span className="min-w-0 truncate">{d.name}</span>
                    <span className="flex items-center gap-3 shrink-0 text-xs">
                      <span className="font-medium">{money(d.amount, symbol)}</span>
                      {d.dueDate ? <span className="text-muted-foreground">{formatDate(d.dueDate)}</span> : <span className="text-muted-foreground">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="size-4" /> Next Activity</CardTitle></CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No upcoming events.</p>
            ) : (
              <div className="space-y-1.5">
                {data.events.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(e.startAt)}{e.isOnline ? " · Online" : ""}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${e.myRsvp ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}`}>{e.myRsvp ? e.myRsvp.replace(/_/g, " ") : "No RSVP"}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button render={<Link href={`${base}/events`} />} variant="ghost" size="sm" className="rounded-xl mt-2 h-8 text-xs"><Megaphone className="size-3.5 mr-1" /> Events & RSVP</Button>
          </CardContent>
        </Card>
      </div>

      {/* Polls + activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Vote className="size-4" /> Open Polls</CardTitle></CardHeader>
          <CardContent>
            {data.polls.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No open polls.</p>
            ) : (
              <div className="space-y-1.5">
                {data.polls.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                    <span className="min-w-0 truncate">{p.title}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${p.myVoted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{p.myVoted ? "Voted" : "Vote needed"}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button render={<Link href={`${base}/polls`} />} variant="ghost" size="sm" className="rounded-xl mt-2 h-8 text-xs"><Vote className="size-3.5 mr-1" /> Vote on polls</Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="size-4" /> Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {data.activity.map((a) => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center"><div className="size-2 rounded-full bg-muted-foreground/30 mt-1.5 shrink-0" /><div className="w-px flex-1 bg-border" /></div>
                    <div className="flex-1 pb-2 min-w-0">
                      <p className="truncate">{a.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.authorName || "member"} · {formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button render={<Link href={`${base}/feed`} />} variant="ghost" size="sm" className="rounded-xl mt-2 h-8 text-xs"><MessageCircle className="size-3.5 mr-1" /> Open feed</Button>
          </CardContent>
        </Card>
      </div>

      {/* Itinerary widgets */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between"><span className="flex items-center gap-2"><Calendar className="size-4" /> Itinerary</span><Link href={`${base}/itinerary`} className="text-xs text-brand font-medium hover:underline">Full itinerary</Link></CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MiniIt label="Today / next" value={data.itinerary.todayOrNext ? data.itinerary.todayOrNext.title : "—"} sub={data.itinerary.todayOrNext ? `${data.itinerary.todayOrNext.type.replace(/_/g, " ")}${data.itinerary.todayOrNext.startTime ? ` · ${data.itinerary.todayOrNext.startTime}` : ""}` : ""} />
          <MiniIt label="Next flight" value={data.itinerary.nextFlight ? data.itinerary.nextFlight.title : "—"} sub={data.itinerary.nextFlight?.date ? formatDate(data.itinerary.nextFlight.date) : ""} />
          <MiniIt label="Hotel / check-in" value={data.itinerary.hotel ? data.itinerary.hotel.title : "—"} sub={data.itinerary.hotel?.date ? formatDate(data.itinerary.hotel.date) : ""} />
          <MiniIt label="Upcoming activity" value={data.itinerary.nextActivity ? data.itinerary.nextActivity.title : "—"} sub={data.itinerary.nextActivity?.date ? formatDate(data.itinerary.nextActivity.date) : ""} />
          <MiniIt label="Bookings complete" value={`${data.itinerary.bookingCompletionPct}%`} sub={data.itinerary.missingBookingsCount > 0 || data.itinerary.missingDocumentsCount > 0 ? `${data.itinerary.missingBookingsCount} unbooked · ${data.itinerary.missingDocumentsCount} missing docs` : "All set"} />
        </CardContent>
      </Card>

      {/* Trip details */}
      {t.notes || t.emergencyContact ? (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trip details</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {t.notes && <p>{t.notes}</p>}
            {t.emergencyContact && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="size-3.5" /> Emergency contact: {t.emergencyContact}</p>}
          </CardContent>
        </Card>
      ) : null}

      <SetupTripDialog open={showSetup} onOpenChange={setShowSetup} circleId={circleId} currency={t.currency || "ZAR"} initial={t} onSaved={refresh} />
    </div>
  )
}

function BarBar({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span className="font-semibold">{label} · {pct}%</span><span className="text-muted-foreground">{sub}</span></div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  )
}

function Widget({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <Card className="rounded-2xl"><CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1"><span className="text-muted-foreground">{icon}</span><p className="text-[11px] text-muted-foreground">{label}</p></div>
      <p className={`text-sm sm:text-base font-bold truncate ${tone}`}>{value}</p>
    </CardContent></Card>
  )
}

function MiniIt({ label, value, sub = "" }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl border p-3 min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-sm font-bold mt-0.5 truncate">{value}</p>{sub && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>}</div>
}

function Mini({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${tone}`}>{value}</p></div>
}

function TravelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>)}</div>
      <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</CardContent></Card>
    </div>
  )
}

function SetupTripDialog({ open, onOpenChange, circleId, currency, initial, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  circleId: string
  currency: string
  initial?: TravelTripData["trip"] | null
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit trip" : "Set up trip"}</DialogTitle><DialogDescription>Configure the trip details, dates, currency and funding target.</DialogDescription></DialogHeader>
        {open && <TripForm key={String(open)} circleId={circleId} initial={initial} currency={currency} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function TripForm({ circleId, currency, initial, onOpenChange, onSaved }: {
  circleId: string
  currency: string
  initial?: TravelTripData["trip"] | null
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [f, setF] = useState<Record<string, string>>({
    name: initial?.name || "", destination: initial?.destination || "",
    startDate: initial?.startDate ? initial.startDate.slice(0, 10) : "",
    endDate: initial?.endDate ? initial.endDate.slice(0, 10) : "",
    currency: initial?.currency || currency || "ZAR",
    totalBudget: initial?.totalBudget ? String(initial.totalBudget) : "",
    contributionTarget: initial?.contributionTarget ? String(initial.contributionTarget) : "",
    status: initial?.status || "PLANNING",
    coverImage: initial?.coverImage || "", meetingPoint: initial?.meetingPoint || "",
    emergencyContact: initial?.emergencyContact || "", notes: initial?.notes || "",
  })
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!f.name?.trim()) return toast.error("Trip name is required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/travel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, destination: f.destination || null, startDate: f.startDate || null, endDate: f.endDate || null,
          currency: f.currency || "ZAR", totalBudget: f.totalBudget ? Number(f.totalBudget) : null,
          contributionTarget: f.contributionTarget ? Number(f.contributionTarget) : null, status: f.status || "PLANNING",
          coverImage: f.coverImage || null, meetingPoint: f.meetingPoint || null, emergencyContact: f.emergencyContact || null, notes: f.notes || null,
        }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Trip saved"); onOpenChange(false); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Trip name"><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} className="rounded-xl" placeholder="e.g. Cape Town Adventure" /></Field>
        <Field label="Destination"><Input value={f.destination || ""} onChange={(e) => setF({ ...f, destination: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Start date"><Input type="date" value={f.startDate || ""} onChange={(e) => setF({ ...f, startDate: e.target.value })} className="rounded-xl" /></Field>
        <Field label="End date"><Input type="date" value={f.endDate || ""} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Currency"><Select value={f.currency || "ZAR"} onValueChange={(v) => setF({ ...f, currency: v || "ZAR" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Status"><Select value={f.status || "PLANNING"} onValueChange={(v) => setF({ ...f, status: v || "PLANNING" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Total trip budget"><Input type="number" value={f.totalBudget || ""} onChange={(e) => setF({ ...f, totalBudget: e.target.value })} className="rounded-xl" /></Field>
        <Field label="Contribution target"><Input type="number" value={f.contributionTarget || ""} onChange={(e) => setF({ ...f, contributionTarget: e.target.value })} className="rounded-xl" /></Field>
      </div>
      <Field label="Meeting / departure point"><Input value={f.meetingPoint || ""} onChange={(e) => setF({ ...f, meetingPoint: e.target.value })} className="rounded-xl" /></Field>
      <Field label="Emergency contact"><Input value={f.emergencyContact || ""} onChange={(e) => setF({ ...f, emergencyContact: e.target.value })} className="rounded-xl" /></Field>
      <Field label="Notes"><Textarea value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} className="rounded-xl" rows={2} /></Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
        <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Saving..." : "Save trip"}</Button>
      </DialogFooter>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>
}