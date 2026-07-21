import {
  LayoutDashboard, Users, Globe, Compass, Shield, CreditCard,
  DollarSign, TrendingUp, Activity, ScrollText, Wallet,
  ShieldCheck, Layers, Settings, Tag, Megaphone, MessageCircle,
  UserCog,
} from "lucide-react"
import type { FC } from "react"

export interface OwnerNavItem {
  href: string
  label: string
  icon: FC<{ className?: string }>
}

export interface OwnerNavGroup {
  label: string
  items: OwnerNavItem[]
}

export const ownerNavGroups: OwnerNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/owner", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { href: "/owner/users", label: "Users", icon: Users },
      { href: "/owner/admins", label: "Admins", icon: UserCog },
      { href: "/owner/support", label: "Support", icon: MessageCircle },
    ],
  },
  {
    label: "Communities",
    items: [
      { href: "/owner/circles", label: "Circles", icon: Globe },
      { href: "/owner/discover", label: "Discover", icon: Compass },
      { href: "/owner/moderation", label: "Moderation", icon: Shield },
      { href: "/owner/verifications", label: "Verifications", icon: ShieldCheck },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/owner/subscriptions", label: "Subscriptions", icon: ScrollText },
      { href: "/owner/payments", label: "Payments", icon: DollarSign },
      { href: "/owner/revenue", label: "Revenue", icon: TrendingUp },
      { href: "/owner/wallets", label: "Wallets", icon: Wallet },
      { href: "/owner/plans", label: "Plans", icon: CreditCard },
      { href: "/owner/promotions", label: "Promos", icon: Tag },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/owner/broadcasts", label: "Broadcasts", icon: Megaphone },
      { href: "/owner/analytics", label: "Analytics", icon: TrendingUp },
      { href: "/owner/fraud", label: "Fraud", icon: Shield },
      { href: "/owner/bulk-operations", label: "Bulk Ops", icon: Layers },
      { href: "/owner/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/owner/health", label: "Health", icon: Activity },
      { href: "/owner/platform-settings", label: "Platform", icon: Settings },
    ],
  },
]
