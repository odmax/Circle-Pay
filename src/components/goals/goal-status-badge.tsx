import { Badge } from "@/components/ui/badge"

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  COMPLETED: { label: "Completed", color: "bg-brand-50 text-brand-700 border-brand-200" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-50 text-slate-500 border-slate-200" },
  ARCHIVED: { label: "Archived", color: "bg-slate-50 text-slate-400 border-slate-200" },
}

export function GoalStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.ACTIVE
  return (
    <Badge variant="outline" className={`border text-xs font-medium ${config.color}`}>
      {config.label}
    </Badge>
  )
}
