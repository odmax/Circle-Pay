import { Badge } from "@/components/ui/badge"
import type { ReceiptStatus } from "@/generated/prisma"

interface ReceiptStatusBadgeProps {
  status: ReceiptStatus
  className?: string
}

const statusConfig: Record<
  ReceiptStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  VOIDED: {
    label: "Voided",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  REPLACED: {
    label: "Replaced",
    className:
      "border-slate-200 bg-slate-50 text-slate-600",
  },
}

export function ReceiptStatusBadge({
  status,
  className,
}: ReceiptStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.ACTIVE

  return (
    <Badge variant="outline" className={`text-[10px] ${config.className} ${className ?? ""}`}>
      {config.label}
    </Badge>
  )
}
