import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { LayoutDashboard, Users, Globe, Compass, Shield, CreditCard, DollarSign, TrendingUp, Activity, ScrollText, Wallet, ShieldCheck, Layers, Settings, Tag, Megaphone, MessageCircle, UserCog, ArrowLeft } from "lucide-react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { CommandPalette } from "@/components/layout/command-palette"
import { PageTransition } from "@/components/layout/page-transition"

const groups = [
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
      { href: "/owner/subscriptions", label: "Subscriptions", icon: ScrollText as any },
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

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const admin = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })
  if (!admin || !admin.isActive) redirect("/owner/login?error=no-access")

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#owner-main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-amber-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl">Skip to content</a>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border/40 bg-card lg:flex" role="navigation" aria-label="Owner navigation">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 px-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white"><span className="text-xs font-bold">M</span></div>
          <span className="font-bold tracking-tight">Mozetech Owner</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <l.icon className="size-4" />
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-border/40 bg-background/95 backdrop-blur px-4 lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Back to Dashboard</Link>
          <div className="flex-1" />
          <span className="text-sm font-medium text-muted-foreground">Owner Dashboard</span>
        </header>
        <main id="owner-main" className="flex-1 overflow-y-auto p-4 lg:p-8"><PageTransition>{children}</PageTransition></main>
      </div>
      <CommandPalette />
    </div>
  )
}
