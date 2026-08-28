import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lock, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getVote } from "@/lib/services/governance.service"
import { VoteCastForm } from "@/components/meetings/vote-cast-form"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function VoteDetailPage({ params }: { params: Promise<{ circleId: string; voteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId, voteId } = await params

  let circle, vote
  try {
    ;[circle, vote] = await Promise.all([getCircleById(circleId, session.user.id), getVote(circleId, voteId, session.user.id)])
  } catch {
    notFound()
  }

  const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })

  const status = String(vote.status || "")
  const vType = String(vote.type || "YES_NO")
  const anonymous = !!vote.anonymous
  const options = (vote.options as { id?: string; text?: string }[]) || []
  const myVote = vote.myVote as { records?: { optionId: string; rank?: number | null }[] } | null
  const alreadyVoted = !!myVote && (myVote.records?.length ?? 0) > 0
  const isOpen = status === "OPEN"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/votes`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{String(vote.title || "Vote")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px]">{vType}</Badge>
            <Badge variant={isOpen ? "default" : "outline"} className="text-[10px]">{status}</Badge>
            {anonymous && <span className="flex items-center text-xs text-muted-foreground"><Lock className="size-3 mr-1" /> Anonymous</span>}
          </div>
        </div>
      </div>

      {vote.description ? <p className="text-sm text-muted-foreground">{String(vote.description)}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2"><Scale className="size-4 text-muted-foreground" /> Cast your vote</h2>
            <VoteCastForm circleId={circleId} voteId={voteId} voteType={vType} options={options.map((o) => ({ id: String(o.id), text: String(o.text) }))} alreadyVoted={alreadyVoted} isOpen={isOpen} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Members</span><span className="font-medium">{Number(vote.memberCount ?? 0)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Votes cast</span><span className="font-medium">{Number(vote.totalVotes ?? 0)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Quorum %</span><span className="font-medium">{vote.quorumPercent != null ? `${vote.quorumPercent}%` : "—"}</span></div>
            {!anonymous && canManage && vote.voterIdentities ? (
              <div className="pt-2 border-t"><div className="text-muted-foreground mb-1">Per-option counts</div>{options.map((o) => {
                const opt = (vote.options as { id?: string; text?: string; _count?: { records?: number } }[]).find((x) => String(x.id) === String(o.id))
                return <div key={String(o.id)} className="flex justify-between text-xs"><span>{o.text}</span><span>{opt?._count?.records ?? 0}</span></div>
              })}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
