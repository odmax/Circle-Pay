"use client"

import { Clock, CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type ContributionApprovalStatus = "PENDING_REVIEW" | "CONFIRMED" | "REJECTED" | null

const statusConfig: Record<
  string,
  { label: string; icon: typeof Clock; className: string }
> = {
  PENDING_REVIEW: {
    label: "Pending Review",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CONFIRMED: {
    label: "Confirmed",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
}

export function ContributionApprovalBadge({
  status,
}: {
  status: ContributionApprovalStatus
}) {
  if (!status || !statusConfig[status]) return null

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`gap-1 border text-xs font-medium ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}
