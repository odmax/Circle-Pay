"use client"

import { Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

type ApprovalStats = {
  pending: number
  approvedToday: number
  rejectedToday: number
  overdue: number
}

export function ApprovalStatsBar({ stats }: { stats: ApprovalStats }) {
  const cards = [
    {
      label: "Pending",
      value: stats.pending,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "Approved Today",
      value: stats.approvedToday,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      label: "Rejected Today",
      value: stats.rejectedToday,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      pulse: stats.overdue > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border ${card.border} ${card.bg} p-4`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <card.icon className={`size-4 ${card.color} ${card.pulse ? "animate-pulse" : ""}`} />
          </div>
          <p className={`mt-1 text-2xl font-bold ${card.color}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
