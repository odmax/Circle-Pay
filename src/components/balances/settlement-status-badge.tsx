import { Badge } from "@/components/ui/badge"

const config: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
  CONFIRMED: { label: "Confirmed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-50 text-slate-500 border-slate-200" },
}

export function SettlementStatusBadge({ status }: { status: string }) {
  const c = config[status] ?? config.PENDING
  return (
    <Badge variant="outline" className={`border text-xs font-medium ${c.color}`}>
      {c.label}
    </Badge>
  )
}
