import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BarChart3, Vote, Lock, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCirclePolls } from "@/lib/services/poll.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"
import { CreatePollForm } from "@/components/polls/create-poll-form"
import { PollVoteButton } from "@/components/polls/poll-vote-button"

export default async function PollsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle, polls
  try { [circle, polls] = await Promise.all([getCircleById(circleId, session.user.id), getCirclePolls(circleId)]) }
  catch { notFound() }

  if (!await hasFeature(session.user.id, "POLLS")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  const open = polls.filter((p) => p.status === "OPEN")
  const closed = polls.filter((p) => p.status !== "OPEN")
  const canManage = circle.userRole === "OWNER" || circle.userRole === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
          <div><h1 className="text-2xl font-bold tracking-tight">Polls</h1><p className="text-muted-foreground">{circle.name} — {open.length} open</p></div>
        </div>
        {canManage && <CreatePollForm circleId={circleId} />}
      </div>

      {polls.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><BarChart3 className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No polls yet</p><p className="text-sm text-muted-foreground">Create a poll to make group decisions</p></CardContent></Card>
      ) : (
        <>
          {open.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold">Open ({open.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">{open.map((p) => <PollCard key={p.id} poll={p} canManage={canManage} circleId={circleId} userId={session.user.id} />)}</div>
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-muted-foreground">Closed ({closed.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 opacity-75">{closed.map((p) => <PollCard key={p.id} poll={p} canManage={canManage} circleId={circleId} userId={session.user.id} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PollCard({ poll, circleId, userId }: { poll: Record<string, unknown>; canManage: boolean; circleId: string; userId: string }) {
  const totalVotes = Number((poll._count as Record<string, number>)?.votes || 0)
  const userVote = ((poll.votes as Record<string, unknown>[]) || []).find((v) => v.userId === userId)
  const options = (poll.options as Record<string, unknown>[]) || []
  const pollStatus = String(poll.status || "")
  const pollTitle = String(poll.title || "")
  const pollType = String(poll.type || "")
  const pollId = String(poll.id || "")
  const isAnonymous = !!poll.isAnonymous
  return (
    <Card className={`rounded-2xl ${pollStatus === "OPEN" ? "border-brand-200 bg-brand-50/10" : "border-border/40"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">{pollTitle}</h3>
            <div className="flex items-center gap-2 mt-1"><Badge variant="outline" className="text-[10px]">{pollType}</Badge><Badge variant="outline" className={pollStatus === "OPEN" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "text-[10px]"}>{pollStatus}</Badge>{isAnonymous && <Lock className="size-3 text-muted-foreground" />}</div>
          </div>
          <span className="text-xs text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
        </div>
        <div className="space-y-1.5">
          {options.map((opt) => {
            const voteCount = Number((opt._count as Record<string, number>)?.votes || 0)
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
            const isSelected = userVote?.optionId === opt.id
            return (
              <div key={String(opt.id)} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {pollStatus === "OPEN" && <PollVoteButton circleId={circleId} pollId={pollId} optionId={String(opt.id)} selected={!!isSelected} />}
                  <span className="flex-1">{String(opt.text)}</span>
                  <span className="text-xs font-medium text-muted-foreground">{voteCount}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
