import { Badge } from "@/components/ui/badge"

const variants = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
}

export function StatusBadge({ variant, children }: { variant: keyof typeof variants; children: React.ReactNode }) {
  return <Badge variant="outline" className={`text-[10px] ${variants[variant]}`}>{children}</Badge>
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "border-purple-200 bg-purple-50 text-purple-700",
    ADMIN: "border-blue-200 bg-blue-50 text-blue-700",
    SUPPORT: "border-emerald-200 bg-emerald-50 text-emerald-700",
    FINANCE: "border-amber-200 bg-amber-50 text-amber-700",
    OWNER: "border-indigo-200 bg-indigo-50 text-indigo-700",
    MEMBER: "border-slate-200 bg-slate-50 text-slate-600",
  }
  return <Badge variant="outline" className={`text-[10px] ${map[role] || ""}`}>{role}</Badge>
}
