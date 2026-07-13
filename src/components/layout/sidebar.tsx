"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useAdminStatus } from "@/hooks/use-admin-status"
import { LayoutDashboard, Globe, Settings, PlusCircle, Loader2, Bell, ArrowUp, Compass, MessageCircle, Users, Search, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CircleSwitcher } from "@/components/layout/circle-switcher"

const groups = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/circles", label: "My Circles", icon: Users },
      { href: "/discover", label: "Discover", icon: Compass },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/upgrade", label: "Upgrade", icon: ArrowUp },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/support", label: "Support", icon: MessageCircle },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const isCircleRoute = pathname.startsWith("/circles/") && pathname.split("/").length >= 3

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex" role="navigation" aria-label="Main navigation">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><span className="text-sm font-bold">C</span></div>
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">Circle Pay</Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-1">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                return (
                  <Link key={link.href} href={link.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
                    <link.icon className="size-4" />{link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

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
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); signOut({ callbackUrl: "/login" }) }} className="text-destructive">Sign Out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
