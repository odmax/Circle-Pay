export type NavIconName =
  | "dashboard"
  | "circles"
  | "discover"
  | "notifications"
  | "portfolio"
  | "receipts"
  | "upgrade"
  | "support"
  | "settings"
  | "owner-dashboard"
  | "owner-users"
  | "owner-circles"
  | "owner-payments"
  | "owner-health"

export type NavItem = {
  label: string
  href: string
  iconName: NavIconName
  ownerOnly?: boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const mainNav: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", iconName: "dashboard" },
      { label: "My Circles", href: "/circles", iconName: "circles" },
      { label: "Notifications", href: "/notifications", iconName: "notifications" },
      { label: "Discover", href: "/discover", iconName: "discover" },
      { label: "Portfolio", href: "/portfolio", iconName: "portfolio" },
      { label: "Receipts", href: "/receipts", iconName: "receipts" },
      { label: "Upgrade", href: "/upgrade", iconName: "upgrade" },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Support Center", href: "/support", iconName: "support" },
      { label: "Settings", href: "/settings", iconName: "settings" },
    ],
  },
  {
    label: "Owner",
    items: [
      { label: "Dashboard", href: "/owner", iconName: "owner-dashboard", ownerOnly: true },
      { label: "Users", href: "/owner/users", iconName: "owner-users", ownerOnly: true },
      { label: "Circles", href: "/owner/circles", iconName: "owner-circles", ownerOnly: true },
      { label: "Payments", href: "/owner/payments", iconName: "owner-payments", ownerOnly: true },
      { label: "System Health", href: "/owner/health", iconName: "owner-health", ownerOnly: true },
    ],
  },
]
