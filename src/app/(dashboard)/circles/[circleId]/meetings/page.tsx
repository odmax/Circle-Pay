import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CalendarDays, Plus, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleMeetings } from "@/lib/services/meeting.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function MeetingsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, meetings
  try {
    ;[circle, meetings] = await Promise.all([getCircleById(circleId, session.user.id), getCircleMeetings(circleId, session.user.id)])
  } catch {
    notFound()
  }

  const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })

  const upcoming = meetings.filter((m) => ["SCHEDULED", "DRAFT", "IN_PROGRESS"].includes(String(m.status)))
  const past = meetings.filter((m) => ["COMPLETED", "CANCELLED"].includes(String(m.status)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
            <p className="text-muted-foreground">{circle.name} — {upcoming.length} upcoming</p>
          </div>
        </div>
        {canManage && <Button render={<Link href={`/circles/${circleId}/meetings/new`} />} className="rounded-xl"><Plus className="size-4 mr-1" /> New Meeting</Button>}
      </div>

      {meetings.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><CalendarDays className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No meetings yet</p><p className="text-sm text-muted-foreground">Schedule your first meeting</p></CardContent></Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold">Upcoming ({upcoming.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">{upcoming.map((m) => <MeetingCard key={String(m.id)} m={m} circleId={circleId} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-muted-foreground">Past ({past.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 opacity-75">{past.map((m) => <MeetingCard key={String(m.id)} m={m} circleId={circleId} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MeetingCard({ m, circleId }: { m: Record<string, unknown>; circleId: string }) {
  const id = String(m.id)
  const title = String(m.title || "")
  const status = String(m.status || "")
  const type = String(m.type || "")
  const rsvps = Number((m._count as Record<string, number>)?.rsvps || 0)
  const scheduledAt = m.scheduledAt ? new Date(m.scheduledAt as string).toLocaleString() : "—"
  return (
    <Button variant="outline" className="h-auto p-0 rounded-2xl" render={<Link href={`/circles/${circleId}/meetings/${id}`} />}>
      <Card className="w-full border-0 rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Clock className="size-3" /> {scheduledAt}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={status === "SCHEDULED" ? "default" : "outline"} className="text-[10px]">{status}</Badge>
              <Badge variant="outline" className="text-[10px]">{type}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3" /> {rsvps} attending</div>
        </CardContent>
      </Card>
    </Button>
  )
}
