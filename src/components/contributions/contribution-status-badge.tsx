import { Badge } from "@/components/ui/badge"
import type { ContributionStatus } from "@/generated/prisma"

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  PAID: { label: "Paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
  OVERDUE: { label: "Overdue", color: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-50 text-slate-500 border-slate-200" },
}

export function ContributionStatusBadge({
  status,
}: {
  status: ContributionStatus | string
}) {
  const config = statusConfig[status] ?? statusConfig.PENDING
  return (
    <Badge
      variant="outline"
      className={`border text-xs font-medium ${config.color}`}
    >
      {config.label}
    </Badge>
  )
}

const frequencyConfig: Record<
  string,
  string
> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  ONCE_OFF: "Once-off",
  CUSTOM: "Custom",
}

export function FrequencyBadge({ frequency }: { frequency: string }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {frequencyConfig[frequency] ?? frequency}
    </span>
  )
}
