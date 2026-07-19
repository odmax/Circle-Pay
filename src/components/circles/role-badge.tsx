import { Badge } from "@/components/ui/badge"
import type { MemberRole } from "@/generated/prisma"

const roleConfig: Record<
  string,
  { label: string; color: string }
> = {
  OWNER: { label: "Owner", color: "bg-brand-50 text-brand-700 border-brand-200" },
  ADMIN: { label: "Admin", color: "bg-blue-50 text-blue-700 border-blue-200" },
  TREASURER: { label: "Treasurer", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MEMBER: { label: "Member", color: "bg-slate-50 text-slate-600 border-slate-200" },
  VIEWER: { label: "Viewer", color: "bg-amber-50 text-amber-700 border-amber-200" },
}

export function RoleBadge({ role }: { role: MemberRole }) {
  const config = roleConfig[role] ?? roleConfig.MEMBER
  return (
    <Badge
      variant="outline"
      className={`border text-xs font-medium ${config.color}`}
    >
      {config.label}
    </Badge>
  )
}
