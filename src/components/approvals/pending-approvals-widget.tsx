"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type ApprovalStats = {
  pending: number
  approvedToday: number
  rejectedToday: number
  overdue: number
}

type PendingApproval = {
  id: string
  type: string
  title: string
  status: string
  amount: number | null
  currency: string | null
  requestedAt: string
  requestedBy: { id: string; name: string | null; image: string | null }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function typeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PendingApprovalsWidget({
  circleId,
  className,
}: {
  circleId: string
  className?: string
}) {
  const [stats, setStats] = useState<ApprovalStats | null>(null)
  const [items, setItems] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch(`/api/circles/${circleId}/approvals/stats`),
        fetch(`/api/circles/${circleId}/approvals?status=pending&limit=5`),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        // API wraps response in { success, data }
        setStats(statsData.data ?? statsData)
      }

      if (listRes.ok) {
        const listData = await listRes.json()
        const payload = listData.data ?? listData
        const raw = Array.isArray(payload) ? payload : payload.requests ?? []
        setItems(raw)
      }
    } catch {
      // Silently degrade — permissions vary and the widget shouldn't error-spam
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    fetchData()

    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const pendingCount = stats?.pending ?? 0
  const overdueCount = stats?.overdue ?? 0

  return (
    <Card className={`rounded-2xl border-border/40 ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Pending Approvals</CardTitle>
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : pendingCount > 0 ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 px-1.5 py-0 text-xs"
            >
              {pendingCount}
            </Badge>
          ) : null}
        </div>
        {overdueCount > 0 && !loading && (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-600 gap-1 text-xs"
          >
            <AlertTriangle className="size-3" />
            {overdueCount} overdue
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              No pending approvals
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const initials = item.requestedBy.name
                ? item.requestedBy.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "??"

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl p-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={item.requestedBy.image || ""} />
                    <AvatarFallback className="text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="truncate block font-medium">
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.requestedBy.name ?? "Member"} &middot;{" "}
                      {typeLabel(item.type)}
                    </span>
                  </div>
                  {item.amount != null && (
                    <span className="font-mono text-xs font-semibold shrink-0">
                      {item.currency ?? ""}{item.amount.toLocaleString()}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {timeAgo(item.requestedAt)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <Button
          render={
            <Link href={`/circles/${circleId}/manage/approvals`} />
          }
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-between text-xs"
        >
          Go to approvals queue
          <ChevronRight className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}
