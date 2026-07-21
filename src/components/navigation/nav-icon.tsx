import type { NavIconName } from "@/lib/navigation/app-navigation"
import {
  LayoutDashboard,
  Users,
  Compass,
  Bell,
  Wallet,
  Receipt,
  ArrowUp,
  MessageCircle,
  Settings,
  Shield,
  ShieldCheck,
  CreditCard,
  HeartPulse,
  HelpCircle,
} from "lucide-react"

const iconRegistry: Record<NavIconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  circles: Users,
  discover: Compass,
  notifications: Bell,
  portfolio: Wallet,
  receipts: Receipt,
  upgrade: ArrowUp,
  support: MessageCircle,
  settings: Settings,
  "owner-dashboard": Shield,
  "owner-users": ShieldCheck,
  "owner-circles": Users,
  "owner-payments": CreditCard,
  "owner-health": HeartPulse,
}

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = iconRegistry[name] ?? HelpCircle
  return <Icon className={className} aria-hidden="true" />
}
