"use client"

import { useState, useEffect } from "react"
import { Clock, Activity, DollarSign, FileText, Users, Box, TrendingUp, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "../types"
import type { CircleData } from "../types"

interface TimelineTabProps { circle: CircleData; circleId: string; projectId: string }

interface ActivityItem { id: string; type: string; title: string; description?: string | null; createdAt: string; userId?: string | null }

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Activity,
  capital_tx_recorded: DollarSign, capital_tx_confirmed: CheckCircle2,
  expense_created: FileText, expense_approved: CheckCircle2, expense_rejected: XCircle, expense_paid: DollarSign,
  revenue_recorded: TrendingUp,
  asset_created: Box, asset_sold: DollarSign,
  ownership_proposed: Users, ownership_approved: CheckCircle2,
  distribution_created: TrendingUp, distribution_approved: CheckCircle2, distribution_paid: DollarSign,
  financial_statement_generated: FileText,
}

const ACTIVITY_COLORS: Record<string, string> = {
  created: "bg-blue-500", capital_tx_recorded: "bg-emerald-500", capital_tx_confirmed: "bg-emerald-500",
  expense_created: "bg-amber-500", expense_approved: "bg-emerald-500", expense_paid: "bg-brand", expense_rejected: "bg-red-500",
  revenue_recorded: "bg-emerald-500", asset_created: "bg-purple-500",
  ownership_proposed: "bg-blue-500", ownership_approved: "bg-emerald-500",
  distribution_created: "bg-amber-500", distribution_approved: "bg-emerald-500", distribution_paid: "bg-brand",
  financial_statement_generated: "bg-blue-500",
}

export function TimelineTab({ circle, circleId, projectId }: TimelineTabProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/activities?limit=100`)
        if (!cancelled && r.ok) {
          const data = await r.json()
          setActivities(data.activities || [])
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId])

  if (loading) return <TimelineSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><h2 className="text-sm font-medium">Activity Timeline</h2></div>

      {activities.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No activity recorded yet</p></CardContent></Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-0">
              {activities.map((a, i) => (
                <div key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < activities.length - 1 && <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />}
                  <div className={`size-[22px] rounded-full shrink-0 mt-0.5 flex items-center justify-center ${ACTIVITY_COLORS[a.type] || "bg-muted-foreground/30"}`}>
                    <ActivityIcon type={a.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                    <span className="text-[10px] text-muted-foreground mt-1 block">{formatDate(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICONS[type] || Activity
  return <Icon className="size-3 text-white" />
}

function TimelineSkeleton() {
  return <div className="space-y-4"><Card className="rounded-2xl"><CardContent className="p-4 space-y-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex gap-3"><Skeleton className="size-5 rounded-full shrink-0" /><div className="flex-1"><Skeleton className="h-4 w-48 mb-1" /><Skeleton className="h-3 w-32" /></div></div>)}</CardContent></Card></div>
}
