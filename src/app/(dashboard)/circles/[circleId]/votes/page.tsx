import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Scale, Lock, FileCheck2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleVotes, getCircleDecisions } from "@/lib/services/governance.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function VotesPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, votes, decisions
  try {
    ;[circle, votes, decisions] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getCircleVotes(circleId, session.user.id),
      getCircleDecisions(circleId, session.user.id).catch(() => []),
    ])
  } catch {
    notFound()
  }

  const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })
  const open = votes.filter((v) => String(v.status) === "OPEN")
  const closed = votes.filter((v) => String(v.status) !== "OPEN")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Governance Votes</h1>
            <p className="text-muted-foreground">{circle.name} — {open.length} open</p>
          </div>
        </div>
        {canManage && <Button render={<Link href={`/circles/${circleId}/votes/new`} />} className="rounded-xl"><Plus className="size-4 mr-1" /> New Vote</Button>}
      </div>

      {votes.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><Scale className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No votes yet</p><p className="text-sm text-muted-foreground">Raise a motion and open a governance vote</p></CardContent></Card>
      ) : (
        <>
          {open.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold">Open ({open.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">{open.map((v) => <VoteCard key={String(v.id)} v={v} circleId={circleId} />)}</div>
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-muted-foreground">Closed ({closed.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 opacity-75">{closed.map((v) => <VoteCard key={String(v.id)} v={v} circleId={circleId} />)}</div>
            </div>
          )}
        </>
      )}

      {decisions.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2"><FileCheck2 className="size-4 text-muted-foreground" /> Decisions ({decisions.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">{decisions.map((d) => {
            const dd = d as { id?: string; title?: string; outcome?: string; motionCategory?: string }
            return (
              <Card key={String(dd.id)} className="rounded-2xl">
                <CardContent className="p-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{dd.title}</div>
                    <Badge variant="outline" className="text-[10px] mt-1">{dd.motionCategory}</Badge>
                  </div>
                  <Badge variant={dd.outcome === "APPROVED" ? "default" : "destructive"} className="text-[10px]">{dd.outcome}</Badge>
                </CardContent>
              </Card>
            )
          })}</div>
        </div>
      )}
    </div>
  )
}

function VoteCard({ v, circleId }: { v: Record<string, unknown>; circleId: string }) {
  const id = String(v.id)
  const title = String(v.title || "")
  const status = String(v.status || "")
  const category = String(v.motionCategory || "")
  const anonymous = !!v.anonymous
  const counts = (v.resultCounts as { count?: number }[]) || []
  const totalVotes = counts.reduce((sum, c) => sum + Number(c.count ?? 0), 0)
  return (
    <Button variant="outline" className="h-auto p-0 rounded-2xl" render={<Link href={`/circles/${circleId}/votes/${id}`} />}>
      <Card className="w-full border-0 rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">{category}</Badge>
                <Badge variant={status === "OPEN" ? "default" : "outline"} className="text-[10px]">{status}</Badge>
                {anonymous && <Lock className="size-3 text-muted-foreground" />}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
          </div>
        </CardContent>
      </Card>
    </Button>
  )
}
