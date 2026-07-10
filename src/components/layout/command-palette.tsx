"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, LayoutDashboard, Users, Globe, Shield, CreditCard, DollarSign, TrendingUp, Wallet, Settings, Megaphone, Activity, MessageCircle, Compass, ShieldCheck, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getRecentlyViewed, type RecentItem } from "@/lib/recently-viewed"

type PaletteItem = { label: string; href?: string; icon?: React.ComponentType<{ className?: string }>; group: string; badge?: string }

const ITEMS: PaletteItem[] = [
  { label: "Owner Dashboard", href: "/owner", icon: LayoutDashboard, group: "Owner" },
  { label: "Users", href: "/owner/users", icon: Users, group: "Owner" },
  { label: "Admins", href: "/owner/admins", icon: ShieldCheck, group: "Owner" },
  { label: "Circles", href: "/owner/circles", icon: Globe, group: "Owner" },
  { label: "Discover", href: "/owner/discover", icon: Compass, group: "Owner" },
  { label: "Moderation", href: "/owner/moderation", icon: Shield, group: "Owner" },
  { label: "Verifications", href: "/owner/verifications", icon: ShieldCheck, group: "Owner" },
  { label: "Subscriptions", href: "/owner/subscriptions", icon: CreditCard, group: "Owner" },
  { label: "Payments", href: "/owner/payments", icon: DollarSign, group: "Owner" },
  { label: "Revenue", href: "/owner/revenue", icon: TrendingUp, group: "Owner" },
  { label: "Wallets", href: "/owner/wallets", icon: Wallet, group: "Owner" },
  { label: "Plans", href: "/owner/plans", icon: CreditCard, group: "Owner" },
  { label: "Promos", href: "/owner/promotions", icon: DollarSign, group: "Owner" },
  { label: "Broadcasts", href: "/owner/broadcasts", icon: Megaphone, group: "Owner" },
  { label: "Analytics", href: "/owner/analytics", icon: TrendingUp, group: "Owner" },
  { label: "Fraud", href: "/owner/fraud", icon: Shield, group: "Owner" },
  { label: "Audit Logs", href: "/owner/audit-logs", icon: Activity, group: "Owner" },
  { label: "Health", href: "/owner/health", icon: Activity, group: "Owner" },
  { label: "Platform Settings", href: "/owner/platform-settings", icon: Settings, group: "Owner" },
  { label: "Support", href: "/owner/support", icon: MessageCircle, group: "Owner" },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "User" },
  { label: "My Circles", href: "/circles", icon: Globe, group: "User" },
  { label: "Discover", href: "/discover", icon: Compass, group: "User" },
  { label: "Upgrade", href: "/upgrade", icon: TrendingUp, group: "User" },
  { label: "Settings", href: "/settings", icon: Settings, group: "User" },
  { label: "Support", href: "/support", icon: MessageCircle, group: "User" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [recent, setRecent] = useState<RecentItem[]>([])

  useEffect(() => { setRecent(getRecentlyViewed()) }, [open])
  const filtered = q ? ITEMS.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()) || i.group.toLowerCase().includes(q.toLowerCase())) : ITEMS

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setOpen((v) => !v) }
      if (e.key === "Escape" && open) { setOpen(false) }
    }
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="bg-card border rounded-2xl shadow-xl w-full max-w-lg p-4 space-y-3 mx-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, circles, users..." className="rounded-xl pl-9" autoFocus /></div>
        <div className="max-h-80 overflow-y-auto space-y-3">
          {/* Recently Viewed */}
          {!q && recent.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">Recent</p>
              <div className="space-y-0.5">
                {recent.slice(0, 6).map((r) => (
                  <Link key={r.href} href={r.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                    <Clock className="size-4 text-muted-foreground" />
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{r.group}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(["Owner", "User"] as const).map((group) => {
            const items = filtered.filter((i) => i.group === group)
            if (items.length === 0) return null
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{group}</p>
                <div className="space-y-0.5">
                  {items.slice(0, 12).map((item) => (
                    <Link key={item.label} href={item.href || "#"} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                      {item.icon && <item.icon className="size-4 text-muted-foreground" />}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No results</p>}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
          <span><kbd className="border rounded px-1 py-0.5 mr-1">Ctrl+K</kbd> Search pages</span>
          <span><kbd className="border rounded px-1 py-0.5 mr-1">Ctrl+J</kbd> Switch circle</span>
        </div>
      </div>
    </div>
  )
}
