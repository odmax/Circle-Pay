"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAdminStatus } from "@/hooks/use-admin-status"
import { Loader2, LogOut, PlusCircle, Search, Shield, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNav } from "@/lib/navigation/app-navigation"
import { isNavigationItemActive, filterNavigationSections } from "@/lib/navigation/navigation-utils"
import { NavIcon } from "@/components/navigation/nav-icon"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet"
import { CircleSwitcher } from "@/components/layout/circle-switcher"
import { SignOutItem } from "@/components/layout/signout-item"
import { useSidebar } from "./sidebar-provider"

function NavSections({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname()
  const { isAdmin, isPrimaryOwner } = useAdminStatus()
  const sections = filterNavigationSections(mainNav, { isAdmin: !!isAdmin, isPrimaryOwner: !!isPrimaryOwner })

  const labelClass = mobile
    ? "text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 mb-1.5"
    : "text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-1"

  const linkClasses = (isActive: boolean) => mobile
    ? cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
    : cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className={labelClass}>{section.label}</p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = isNavigationItemActive(pathname, item.href)
              const link = (
                <Link href={item.href} className={linkClasses(isActive)}>
                  <NavIcon name={item.iconName} className="size-4 shrink-0" />
                  {item.label}
                </Link>
              )
              if (mobile) {
                return <SheetClose key={item.href} render={link} />
              }
              return <div key={item.href}>{link}</div>
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function DesktopSidebar() {
  const pathname = usePathname()
  const isCircleRoute = pathname.startsWith("/circles/") && pathname.split("/").length >= 3

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex" role="navigation" aria-label="Main navigation">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><span className="text-sm font-bold">C</span></div>
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">Circle Pay</Link>
      </div>

      <NavSections />

      <div className="shrink-0 border-t border-sidebar-border px-3 py-4 space-y-2">
        <Button render={<Link href="/circles/new" />} variant="secondary" className="w-full justify-start gap-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
          <PlusCircle className="size-4" />New Circle
        </Button>
        <Button render={<Link href="/join" />} variant="ghost" className="w-full justify-start gap-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
          <Search className="size-4" />Join Circle
        </Button>
        {isCircleRoute && (
          <div className="pt-1">
            <CircleSwitcher currentId={pathname.split("/")[2]} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-3"><UserMenu /></div>
    </aside>
  )
}

function MobileSheet() {
  const { open, setOpen } = useSidebar()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" showCloseButton={false} className="p-0 max-w-sm min-w-[280px]">
        <div className="flex h-full flex-col bg-background text-foreground">
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

          <NavSections mobile />

          <div className="shrink-0 border-t border-border px-3 py-4 space-y-2">
            <SheetClose
              render={
                <Link
                  href="/circles/new"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                />
              }
            >
              <PlusCircle className="size-4" />
              New Circle
            </SheetClose>
            <Link href="/api/auth/logout" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="size-4" />
              Sign Out
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function UserMenu() {
  const { data: session, status } = useSession()
  const { isAdmin, isPrimaryOwner, isLoading: adminLoading } = useAdminStatus()
  const user = session?.user
  const initials = user?.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent/50 transition-colors" />}>
        <Avatar className="size-8"><AvatarImage src={user?.image || ""} /><AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">{status === "loading" ? <Loader2 className="size-3 animate-spin" /> : initials}</AvatarFallback></Avatar>
        <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium leading-none truncate">{user?.name || "User"}{isPrimaryOwner && <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Primary Owner</span>}</p><p className="text-xs text-sidebar-foreground/50 truncate">{user?.email || ""}</p></div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/support" />}>Support</DropdownMenuItem>
        {isAdmin && <DropdownMenuItem render={<Link href="/owner" />}><Shield className="size-4 mr-2" /> Admin Dashboard</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <SignOutItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSheet />
    </>
  )
}
