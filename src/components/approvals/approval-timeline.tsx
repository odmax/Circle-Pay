"use client"

import {
  Send,
  CheckCircle2,
  XCircle,
  CircleCheckBig,
  Ban,
  Clock,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type TimelineEvent = {
  type: string
  user: { id: string; name: string | null; email: string; image: string | null } | null
  timestamp: string
  comment: string | null
  metadata?: Record<string, unknown>
}

const eventConfig: Record<
  string,
  { icon: typeof Send; color: string; bgColor: string; label: string }
> = {
  REQUESTED: {
    icon: Send,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Requested",
  },
  APPROVED: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    label: "Approved",
  },
  REJECTED: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Rejected",
  },
  COMPLETED: {
    icon: CircleCheckBig,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    label: "Completed",
  },
  CANCELLED: {
    icon: Ban,
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    label: "Cancelled",
  },
  EXPIRED: {
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    label: "Expired",
  },
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export function ApprovalTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className="relative space-y-0">
      {events.map((event, idx) => {
        const config = eventConfig[event.type] ?? eventConfig.REQUESTED
        const Icon = config.icon
        const isLast = idx === events.length - 1

        return (
          <div key={idx} className="relative flex gap-3 pb-4">
            {!isLast && (
              <div className="absolute left-[11px] top-6 h-full w-px bg-border/60" />
            )}
            <div
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
            >
              <Icon className={`size-3 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config.label}</span>
                {event.user && (
                  <span className="text-xs text-muted-foreground">
                    by {event.user.name || event.user.email}
                  </span>
                )}
              </div>
              {event.comment && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.comment}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                {formatTimeAgo(event.timestamp)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
