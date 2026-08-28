import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock, MapPin, Users, ClipboardList, ListChecks, FileText, Vote as VoteIcon, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getMeetingById } from "@/lib/services/meeting.service"
import { MeetingRsvpButton } from "@/components/meetings/meeting-rsvp-button"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function MeetingDetailPage({ params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId, meetingId } = await params

  let circle, meeting
  try {
    ;[circle, meeting] = await Promise.all([getCircleById(circleId, session.user.id), getMeetingById(circleId, meetingId, session.user.id)])
  } catch {
    notFound()
  }

  const canCheckIn = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEETING_CHECK_IN })
  const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })

  const rsvps = (meeting.rsvps as Record<string, unknown>[]) || []
  const attendance = (meeting.attendance as Record<string, unknown>[]) || []
  const agendaItems = (meeting.agendaItems as Record<string, unknown>[]) || []
  const actionItems = (meeting.actionItems as Record<string, unknown>[]) || []
  const minutesList = (meeting.minutes as Record<string, unknown>[]) || []

  const myRsvp = rsvps.find((r) => r.userId === session.user.id) as { status?: string } | undefined

  const status = String(meeting.status || "")
  const scheduledAt = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : "—"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <Button render={<Link href={`/circles/${circleId}/meetings`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{String(meeting.title || "Meeting")}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{status}</Badge>
              <Badge variant="outline" className="text-[10px]">{String(meeting.type || "")}</Badge>
              {!!meeting.quorumPercent && <Badge variant="outline" className="text-[10px]">Quorum {meeting.quorumPercent}%</Badge>}
            </div>
          </div>
        </div>
        <MeetingRsvpButton circleId={circleId} meetingId={meetingId} current={myRsvp?.status ?? null} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" /> {scheduledAt}</div>
              {meeting.location && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4" /> {String(meeting.location)}</div>}
              <div className="flex items-center gap-2 text-muted-foreground"><Users className="size-4" /> {rsvps.filter((r) => (r as { status?: string }).status === "GOING").length} going, {rsvps.length} RSVPs</div>
              {meeting.description && <p className="pt-1 text-muted-foreground">{String(meeting.description)}</p>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><ClipboardList className="size-4 text-muted-foreground" /> Agenda ({agendaItems.length})</h2>
              {agendaItems.length === 0 ? <p className="text-sm text-muted-foreground">No agenda items yet.</p> : (
                <ul className="space-y-1.5 text-sm">{agendaItems.map((a) => {
                  const it = a as { id?: string; title?: string; status?: string }
                  return <li key={String(it.id)} className="flex items-center justify-between gap-2"><span>{it.title}</span><Badge variant="outline" className="text-[10px]">{it.status}</Badge></li>
                })}</ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><ListChecks className="size-4 text-muted-foreground" /> Action Items ({actionItems.length})</h2>
              {actionItems.length === 0 ? <p className="text-sm text-muted-foreground">No action items yet.</p> : (
                <ul className="space-y-1.5 text-sm">{actionItems.map((a) => {
                  const it = a as { id?: string; title?: string; status?: string; assignee?: { name?: string } | null }
                  return <li key={String(it.id)} className="flex items-center justify-between gap-2"><span>{it.title}{it.assignee?.name ? <span className="text-muted-foreground"> → {it.assignee.name}</span> : null}</span><Badge variant="outline" className="text-[10px]">{it.status}</Badge></li>
                })}</ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><FileText className="size-4 text-muted-foreground" /> Minutes</h2>
              {minutesList.length === 0 ? <p className="text-sm text-muted-foreground">No minutes yet.</p> : (
                minutesList.map((m) => {
                  const mm = m as { id?: string; status?: string }
                  return (
                    <div key={String(mm.id)} className="flex items-center justify-between text-sm">
                      <span>Minutes</span>
                      <Badge variant="outline" className="text-[10px]">{mm.status}</Badge>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><Users className="size-4 text-muted-foreground" /> Attendance ({attendance.length})</h2>
              <p className="text-xs text-muted-foreground">Present & tracked member attendance.</p>
            </CardContent>
          </Card>

          {(meeting.votes as Record<string, unknown>[] || []).length > 0 && (
            <Card className="rounded-2xl">
              <CardContent className="p-4 space-y-2">
                <h2 className="flex items-center gap-2 text-base font-semibold"><VoteIcon className="size-4 text-muted-foreground" /> Votes</h2>
                {(meeting.votes as Record<string, unknown>[]).map((v) => (
                  <Button key={String(v.id)} variant="outline" size="sm" className="w-full rounded-xl justify-start" render={<Link href={`/circles/${circleId}/votes/${String(v.id)}`} />}>
                    {String(v.title || "Vote")}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {(canCheckIn || canManage) && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/40">
              <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5"><Info className="size-3.5" /> Check-in, attendance recording, agenda and minutes management are handled by circle admins via the API.</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
