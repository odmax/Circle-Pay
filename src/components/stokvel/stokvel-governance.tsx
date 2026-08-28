"use client"

import Link from "next/link"
import { CalendarDays, Vote, FileCheck2, ClipboardCheck, Clock, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface GovernanceCardProps {
  circleId: string
  governance: {
    nextMeeting: {
      id: string
      title: string
      scheduledAt: string | null
      status: string
      countdownDays: number | null
    } | null
    myRSVP: string | null
    quorum: {
      required: number | null
      present: number
      quorumPercent: number | null
      reached: boolean
    } | null
    openVotes: { id: string; title: string; closesAt: string | null; anonymous: boolean }[]
    pendingDecisions: { id: string; title: string; outcome: string }[]
    latestMinutes: { id: string; status: string; publishedAt: string | null } | null
  }
  canVote: boolean
  canManageMeetings: boolean
}

export function StokvelGovernance({ circleId, governance, canVote, canManageMeetings }: GovernanceCardProps) {
  const { nextMeeting, myRSVP, quorum, openVotes, pendingDecisions, latestMinutes } = governance

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" /> Meetings & Governance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextMeeting ? (
          <div className="rounded-xl border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{nextMeeting.title}</span>
              <span className="text-xs capitalize text-muted-foreground">{nextMeeting.status.toLowerCase()}</span>
            </div>
            {nextMeeting.scheduledAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {new Date(nextMeeting.scheduledAt).toLocaleString()}
                {nextMeeting.countdownDays !== null && (
                  <span className="text-amber-600">({nextMeeting.countdownDays}d)</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                RSVP: <span className="font-medium">{myRSVP ?? "Not set"}</span>
              </span>
              {quorum && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    quorum.reached ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                  }`}
                >
                  {quorum.reached ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                  Quorum {quorum.present}/{quorum.required ?? "?"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl flex-1" render={<Link href={`/circles/${circleId}/meetings/${nextMeeting.id}`} />}>
                Open
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming meeting.</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm flex items-center gap-1.5">
            <Vote className="size-4 text-muted-foreground" /> Open votes
          </span>
          <span className="text-sm font-medium">{openVotes.length}</span>
        </div>

        {openVotes.length > 0 && (
          <div className="space-y-1.5">
            {openVotes.slice(0, 3).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">{v.title}</span>
                <Button variant="ghost" size="sm" className="rounded-lg shrink-0" render={<Link href={`/circles/${circleId}/votes`} />}>
                  Vote
                </Button>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm flex items-center gap-1.5">
              <FileCheck2 className="size-4 text-muted-foreground" /> Pending decisions
            </span>
            <span className="text-sm font-medium">{pendingDecisions.length}</span>
          </div>
          {pendingDecisions.slice(0, 3).map((d) => (
            <div key={d.id} className="truncate text-xs text-muted-foreground">
              • {d.title}
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm flex items-center gap-1.5">
              <ClipboardCheck className="size-4 text-muted-foreground" /> Latest minutes
            </span>
          </div>
          {latestMinutes ? (
            <div className="truncate text-xs text-muted-foreground">
              Published {latestMinutes.publishedAt ? new Date(latestMinutes.publishedAt).toLocaleDateString() : "—"}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No published minutes yet.</div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl flex-1"
            render={<Link href={`/circles/${circleId}/meetings`} />}
          >
            Meetings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl flex-1"
            render={<Link href={`/circles/${circleId}/votes`} />}
          >
            Votes
          </Button>
          {canManageMeetings && (
            <Button
              size="sm"
              className="rounded-xl flex-1"
              render={<Link href={`/circles/${circleId}/meetings/new`} />}
            >
              New
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
