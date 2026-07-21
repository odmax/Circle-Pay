"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAdminStatus } from "@/hooks/use-admin-status"
import { Users, X } from "lucide-react"
import { mainNav, type NavIconName } from "@/lib/navigation/app-navigation"
import { isNavigationItemActive, filterNavigationSections } from "@/lib/navigation/navigation-utils"
import { NavIcon } from "@/components/navigation/nav-icon"
import { SheetClose } from "@/components/ui/sheet"
import { SignOutItem } from "@/components/layout/signout-item"

function NavLink({ href, label, iconName, isActive }: { href: string; label: string; iconName: NavIconName; isActive: boolean }) {
  return (
    <SheetClose
      render={
        <Link
          href={href}
          className={
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors" +
            (isActive
              ? " bg-accent text-accent-foreground"
              : " text-muted-foreground hover:bg-accent/50 hover:text-foreground")
          }
        />
      }
    >
      <NavIcon name={iconName} className="size-4 shrink-0" />
      {label}
    </SheetClose>
  )
}

export function MobileSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isAdmin, isPrimaryOwner } = useAdminStatus()
  const sections = filterNavigationSections(mainNav, { isAdmin: !!isAdmin, isPrimaryOwner: !!isPrimaryOwner })

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 h-16">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <span className="text-sm font-bold">C</span>
          </div>
          <div>
            <Link href="/dashboard" className="text-lg font-bold tracking-tight">Circle Pay</Link>
            <p className="text-[10px] text-muted-foreground leading-tight">Manage your circles</p>
          </div>
        </div>
        <SheetClose
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </SheetClose>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isNavigationItemActive(pathname, item.href)
                return <NavLink key={item.href} href={item.href} label={item.label} iconName={item.iconName} isActive={isActive} />
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="shrink-0 border-t border-border px-3 py-4 space-y-2">
        <SheetClose
          render={
            <Link
              href="/circles/new"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            />
          }
        >
          <Users className="size-4" />
          New Circle
        </SheetClose>
        <SignOutItem />
      </div>
    </div>
  )
}
