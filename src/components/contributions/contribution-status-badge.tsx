import { Badge } from "@/components/ui/badge"
import type { ContributionStatus } from "@/generated/prisma"

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  PAID: { label: "Paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_REVIEW: { label: "Pending Review", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PROOF_SUBMITTED: { label: "Proof Submitted", color: "bg-purple-50 text-purple-700 border-purple-200" },
  UPCOMING: { label: "Upcoming", color: "bg-slate-50 text-slate-600 border-slate-200" },
  DUE: { label: "Due", color: "bg-orange-50 text-orange-700 border-orange-200" },
  CONFIRMED: { label: "Confirmed", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  REJECTED: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
  OVERDUE: { label: "Overdue", color: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-50 text-slate-500 border-slate-200" },
}

const verificationConfig: Record<
  string,
  { label: string; color: string }
> = {
  PENDING: { label: "Pending Verification", color: "bg-amber-50 text-amber-700 border-amber-200" },
  VERIFIED: { label: "Auto Verified", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  NEEDS_REVIEW: { label: "Needs Review", color: "bg-blue-50 text-blue-700 border-blue-200" },
  REJECTED: { label: "Verification Rejected", color: "bg-red-50 text-red-700 border-red-200" },
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

export function VerificationBadge({ status }: { status?: string | null }) {
  if (!status) return null
  const config = verificationConfig[status]
  if (!config) return null
  return <Badge variant="outline" className={`border text-[10px] font-medium ${config.color}`}>{config.label}</Badge>
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
