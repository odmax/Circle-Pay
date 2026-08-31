"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Megaphone, Flag, Calendar, HelpCircle, FileText, Waves, ShieldAlert, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/components/projects/types"
import { ProgressBar } from "@/components/projects/charts"

interface InvestorPanelData {
  latestUpdate: { id: string; type: string; title: string; publishedAt: string; isImportant: boolean; acknowledged: number; myAcknowledged: boolean } | null
  updateCount: number
  unreadByMe: number
  milestones: Array<{ id: string; title: string; targetDate: string | null; status: string; progress: number; budget: number | null; actualCost: number }>
  completedMilestones: number
  unresolvedRisks: Array<{ id: string; kind: string; title: string; date: string }>
  questionCount: number
  unansweredQuestions: number
  latestDocuments: Array<{ id: string; category: string; name: string; url: string; createdAt: string }>
  upcomingMeetings: Array<{ id: string; title: string; scheduledAt: string; isOnline: boolean }>
  nextDistribution: { id: string; name: string; amount: number; date: string; status: string } | null
  isInvestor: boolean
  isManager: boolean
}

export function InvestorRelationsPanel({ circleId, projectId, symbol }: { circleId: string; projectId: string; symbol: string }) {
  const [data, setData] = useState<InvestorPanelData | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/dashboard`)
        if (!r.ok) return
        const json = await r.json()
        if (!cancelled) setData(json)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId])

  const base = `/circles/${circleId}/projects/${projectId}/investors`

  if (!data) return <InvestorPanelSkeleton />

  const milestoneAvg = data.milestones.length ? Math.round(data.milestones.reduce((s, m) => s + m.progress, 0) / data.milestones.length) : 0

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Megaphone className="size-4 text-brand" /> Investor Relations</span>
          <Link href={base} className="text-xs text-brand font-medium hover:underline">Open full view</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Section title="Latest update">
          {data.latestUpdate ? (
            <Link href={`${base}?updates=${data.latestUpdate.id}`} className="block">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[9px] ${data.latestUpdate.type === "RISK" ? "border-red-200 bg-red-50 text-red-700" : data.latestUpdate.type === "FINANCIAL" ? "border-teal-200 bg-teal-50 text-teal-700" : ""}`}>{data.latestUpdate.type.replace(/_/g, " ")}</Badge>
                {data.latestUpdate.isImportant && <Badge className="text-[9px] bg-amber-500 text-white border-0">Important</Badge>}
              </div>
              <p className="font-medium text-sm truncate mt-1">{data.latestUpdate.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><CheckCircle2 className="size-3" /> {data.latestUpdate.myAcknowledged ? "Acknowledged" : "Tap to acknowledge"} · {formatDate(data.latestUpdate.publishedAt)}</p>
            </Link>
          ) : data.unreadByMe > 0 ? <UnreadNote n={data.unreadByMe} href={base} /> : <Empty text="No updates yet" />}
        </Section>

        <Section title={`Milestones (${data.completedMilestones}/${data.milestones.length})`}>
          {data.milestones.length > 0 ? (
            <div>
              <div className="flex justify-between text-[10px] mb-1"><span>{data.unansweredQuestions > 0 ? "avg progress" : "avg progress"}</span><span>{milestoneAvg}%</span></div>
              <ProgressBar percent={milestoneAvg} />
              <div className="flex gap-1.5 flex-wrap mt-2">
                {data.milestones.filter((m) => m.status === "AT_RISK" || m.status === "DELAYED").slice(0, 2).map((m) => (
                  <Badge key={m.id} variant="outline" className="text-[9px] border-red-200 bg-red-50 text-red-700">{m.title}</Badge>
                ))}
              </div>
            </div>
          ) : <Empty text="No milestones defined" />}
        </Section>

        <Section title="Open questions & docs">
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-1.5"><HelpCircle className="size-3.5 text-muted-foreground" /> <span className="font-medium">{data.questionCount}</span> questions open</p>
            <p className="flex items-center gap-1.5"><FileText className="size-3.5 text-muted-foreground" /> <span className="font-medium">{data.latestDocuments.length}</span> documents</p>
            <p className="flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" /> <span className="font-medium">{data.upcomingMeetings.length}</span> meetings upcoming</p>
          </div>
        </Section>

        <Section title="Risks & distribution">
          <div className="space-y-1.5">
            {data.unresolvedRisks.length > 0 ? (
              data.unresolvedRisks.slice(0, 2).map((r) => (
                <p key={r.id} className="flex items-center gap-1.5 text-xs text-red-600"><ShieldAlert className="size-3.5 shrink-0" /> <span className="truncate">{r.title}</span></p>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No unresolved risks</p>
            )}
            {data.nextDistribution && (
              <p className="text-xs mt-1"><Waves className="size-3.5 inline mr-1 text-brand" /><span className="font-semibold">{formatCurrency(data.nextDistribution.amount, symbol)}</span> next distribution · {formatDate(data.nextDistribution.date)}</p>
            )}
          </div>
        </Section>
      </CardContent>
      <CardContent className="pt-0 flex gap-2 flex-wrap">
        <Button render={<Link href={`${base}?tab=milestones`} />} variant="outline" size="sm" className="rounded-xl h-8 text-xs"><Flag className="size-3.5 mr-1" /> Milestones</Button>
        <Button render={<Link href={`${base}?tab=questions`} />} variant="outline" size="sm" className="rounded-xl h-8 text-xs"><HelpCircle className="size-3.5 mr-1" /> Q&A</Button>
        <Button render={<Link href={`${base}?tab=documents`} />} variant="outline" size="sm" className="rounded-xl h-8 text-xs"><FileText className="size-3.5 mr-1" /> Documents</Button>
        <Button render={<Link href={`${base}?tab=meetings`} />} variant="outline" size="sm" className="rounded-xl h-8 text-xs"><Calendar className="size-3.5 mr-1" /> Meetings</Button>
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{title}</p>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-2">{text}</p>
}

function UnreadNote({ n, href }: { n: number; href: string }) {
  return <p className="text-xs text-amber-600 font-medium py-2"><Link href={href} className="underline">You have {n} unread important update(s)</Link></p>
}

function InvestorPanelSkeleton() {
  return (
    <Card className="rounded-2xl"><CardContent className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </CardContent></Card>
  )
}