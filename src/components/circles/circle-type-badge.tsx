import { Badge } from "@/components/ui/badge"
import {
  Heart,
  Plane,
  Home,
  Gem,
  PiggyBank,
  Users,
  Church,
  TrendingUp,
  Circle,
} from "lucide-react"

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  FAMILY: { icon: Heart, color: "bg-rose-50 text-rose-700 border-rose-200", label: "Family" },
  TRAVEL: { icon: Plane, color: "bg-sky-50 text-sky-700 border-sky-200", label: "Travel Group" },
  HOUSEMATE: { icon: Home, color: "bg-amber-50 text-amber-700 border-amber-200", label: "Housemates" },
  WEDDING: { icon: Gem, color: "bg-pink-50 text-pink-700 border-pink-200", label: "Wedding" },
  SAVINGS: { icon: PiggyBank, color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Savings" },
  STOKVEL: { icon: Users, color: "bg-violet-50 text-violet-700 border-violet-200", label: "Stokvel" },
  CHURCH: { icon: Church, color: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Church" },
  INVESTMENT: { icon: TrendingUp, color: "bg-blue-50 text-blue-700 border-blue-200", label: "Investment" },
  CUSTOM: { icon: Circle, color: "bg-slate-50 text-slate-700 border-slate-200", label: "Custom" },
}

export function CircleTypeBadge({ type }: { type: string }) {
  const config = typeConfig[type] ?? typeConfig.CUSTOM
  return (
    <Badge
      variant="outline"
      className={`gap-1 border ${config.color} text-xs font-medium`}
    >
      <config.icon className="size-3" />
      {config.label}
    </Badge>
  )
}

export function getCircleIcon(type: string) {
  return (typeConfig[type] ?? typeConfig.CUSTOM).icon
}

export function getCircleColor(type: string) {
  return (typeConfig[type] ?? typeConfig.CUSTOM).color
}
