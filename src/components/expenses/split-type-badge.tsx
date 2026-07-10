import { Badge } from "@/components/ui/badge"

const config: Record<string, { label: string; color: string }> = {
  EQUAL: { label: "Equal Split", color: "bg-blue-50 text-blue-700 border-blue-200" },
  EXACT: { label: "Exact Amounts", color: "bg-purple-50 text-purple-700 border-purple-200" },
  PERCENTAGE: { label: "Percentage", color: "bg-teal-50 text-teal-700 border-teal-200" },
}

export function SplitTypeBadge({ type }: { type: string }) {
  const c = config[type] ?? config.EQUAL
  return (
    <Badge variant="outline" className={`border text-xs font-medium ${c.color}`}>
      {c.label}
    </Badge>
  )
}
