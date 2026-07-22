import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, Video, Clock, Calendar, Users, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleEvents } from "@/lib/services/event.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { isPrimaryOwnerUser } from "@/lib/owner-email"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"
import { EventRSVPActions } from "@/components/events/event-rsvp-actions"
import { CreateEventForm } from "@/components/events/create-event-form"

const typeLabels: Record<string, string> = { MEETING: "Meeting", CONTRIBUTION_DAY: "Contribution Day", PAYOUT_DAY: "Payout Day", FUNDRAISER: "Fundraiser", TRIP: "Trip", CEREMONY: "Ceremony", GENERAL: "Event" }

export default async function EventsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle: any, events: any[] = [], pageError: string | null = null
  try { [circle, events] = await Promise.all([getCircleById(circleId, session.user.id), getCircleEvents(circleId)]) }
  catch (e) { pageError = (e as Error).message; console.error("Events page error:", e) }
  if (pageError || !circle) {
    return (<div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Events</h1></div>
      </div>
      <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="p-4 text-sm text-amber-800">{pageError || "Could not load events"}</CardContent></Card>
    </div>)
  }

  const isOwner = await isPrimaryOwnerUser(session.user.id)
  if (!isOwner && !await hasFeature(session.user.id, "EVENTS")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  const upcoming = events.filter((e) => e.status === "UPCOMING")
  const past = events.filter((e) => e.status !== "UPCOMING")
  const canManage = isOwner || circle.userRole === "OWNER" || circle.userRole === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
          <div><h1 className="text-2xl font-bold tracking-tight">Events</h1><p className="text-muted-foreground">{circle.name} — {upcoming.length} upcoming</p></div>
        </div>
        {canManage && <CreateEventForm circleId={circleId} />}
      </div>

      {events.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><Calendar className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No events yet</p>{canManage ? <div className="mt-3"><CreateEventForm circleId={circleId} /></div> : <p className="text-sm text-muted-foreground">No events scheduled yet</p>}</CardContent></Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold">Upcoming ({upcoming.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} event={e} canManage={canManage} circleId={circleId} userId={session.user.id} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-muted-foreground">Past ({past.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 opacity-75">{past.map((e) => <EventCard key={e.id} event={e} canManage={canManage} circleId={circleId} userId={session.user.id} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
function EventCard({ event: ev, canManage, circleId, userId }: { event: Record<string, unknown>; canManage: boolean; circleId: string; userId: string }) {
  const rsvps = (ev.rsvps as Record<string, unknown>[]) || []
  const userRSVP = rsvps.find((r) => r.userId === userId)
  const going = rsvps.filter((r) => r.status === "GOING").length
  const status = String(ev.status || "")
  const title = String(ev.title || "")
  const type = String(ev.type || "")
  const startAt = String(ev.startAt || "")
  const location = String(ev.location || "")
  const meetingLink = String(ev.meetingLink || "")
  const description = String(ev.description || "")
  const id = String(ev.id || "")
  const isOnline = !!ev.isOnline

  return (
    <Card className={`rounded-2xl ${status === "CANCELLED" ? "opacity-60" : "border-border/40"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{title}</h3>
            <Badge variant="outline" className="text-[10px] mt-1">{typeLabels[type] || type}</Badge>
            {status === "CANCELLED" && <Badge variant="outline" className="text-[10px] ml-1 border-red-200 bg-red-50 text-red-700">Cancelled</Badge>}
          </div>
          {canManage && status === "UPCOMING" && (
            <CancelEventBtn eventId={id} />
          )}
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><Calendar className="size-3" /> {startAt ? new Date(startAt).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
          {location && <div className="flex items-center gap-2"><MapPin className="size-3" /> {location}</div>}
          {isOnline && meetingLink && <div className="flex items-center gap-2"><Video className="size-3" /> <a href={meetingLink} target="_blank" className="text-brand underline">{meetingLink}</a></div>}
        </div>
        {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
        <div className="flex items-center gap-2 text-xs"><Users className="size-3" /> {going} going</div>
        {status === "UPCOMING" && <EventRSVPActions circleId={circleId} eventId={id} currentStatus={userRSVP?.status as string} />}
      </CardContent>
    </Card>
  )
}

function CancelEventBtn({ eventId }: { eventId: string }) {
  return (
    <form action={async () => { "use server"; const { prisma } = await import("@/lib/prisma"); await prisma.circleEvent.update({ where: { id: eventId }, data: { status: "CANCELLED" } }) }}>
      <Button type="submit" variant="ghost" size="icon" className="size-7 rounded-lg text-red-500"><X className="size-3" /></Button>
    </form>
  )
}
