import { Badge } from "@/components/ui/badge"
import {
  ShoppingCart, Home, Zap, Bus, Utensils, Plane, Calendar, Heart, Church, MoreHorizontal,
} from "lucide-react"

const config: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  groceries: { label: "Groceries", icon: ShoppingCart, color: "bg-lime-50 text-lime-700 border-lime-200" },
  rent: { label: "Rent", icon: Home, color: "bg-orange-50 text-orange-700 border-orange-200" },
  utilities: { label: "Utilities", icon: Zap, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  transport: { label: "Transport", icon: Bus, color: "bg-sky-50 text-sky-700 border-sky-200" },
  food: { label: "Food", icon: Utensils, color: "bg-rose-50 text-rose-700 border-rose-200" },
  travel: { label: "Travel", icon: Plane, color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  event: { label: "Event", icon: Calendar, color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  family: { label: "Family", icon: Heart, color: "bg-pink-50 text-pink-700 border-pink-200" },
  church: { label: "Church", icon: Church, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  other: { label: "Other", icon: MoreHorizontal, color: "bg-slate-50 text-slate-600 border-slate-200" },
}

export function ExpenseCategoryBadge({ category }: { category: string }) {
  const c = config[category] ?? config.other
  return (
    <Badge variant="outline" className={`gap-1 border text-xs font-medium ${c.color}`}>
      <c.icon className="size-3" />
      {c.label}
    </Badge>
  )
}
