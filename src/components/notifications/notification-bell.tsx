"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, Loader2, PiggyBank, ShoppingBag, Target, Wallet, Calendar, BarChart3, MessageCircle, Megaphone, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/hooks/use-notifications"
import { cn } from "@/lib/utils"
import { NoNotificationsEmpty } from "@/components/ui/app/empty-state-presets"

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONTRIBUTION_MADE: PiggyBank, CONTRIBUTION_PLAN_CREATED: PiggyBank,
  EXPENSE_ADDED: ShoppingBag,
  GOAL_CREATED: Target, GOAL_ALLOCATION_ADDED: Target, GOAL_COMPLETED: Target,
  WALLET_TRANSACTION: Wallet, WALLET_APPROVAL: Wallet,
  EVENT_REMINDER: Calendar, EVENT_RSVP: Calendar,
  POLL_CREATED: BarChart3, POLL_CLOSED: BarChart3,
  CONTRIBUTION_REMINDER: Bell,
  SUPPORT_REPLY: MessageCircle, SUPPORT_NEW: MessageCircle,
  BROADCAST: Megaphone, SYSTEM: Settings,
}

export function NotificationBell() {
  const router = useRouter()
  const { notifications, unreadCount, loading, optimisticMarkRead, optimisticMarkAllRead } = useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="relative rounded-xl shrink-0" aria-label="Notifications" />}>
        <Bell className="size-4" />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={optimisticMarkAllRead} disabled={loading}>Mark all read</Button>}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[360px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></div>
          ) : notifications.length === 0 ? (
            <div className="py-6"><NoNotificationsEmpty /></div>
          ) : (
            notifications.slice(0, 8).map((n: any) => {
              const Icon = TYPE_ICONS[n.type]
              return (
                <div key={n.id} className={cn("flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50", !n.isRead && "bg-brand-50/40")}
                  onClick={() => { if (!n.isRead) optimisticMarkRead(n.id); if (n.link) router.push(n.link) }}>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    {Icon ? <Icon className="size-4 text-muted-foreground" /> : <Bell className="size-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {n.circle && <span className="text-[10px] text-brand font-medium">{n.circle.name}</span>}
                      <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {!n.isRead && <div className="mt-1.5 size-2 rounded-full bg-brand shrink-0" />}
                </div>
              )
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2"><Button variant="ghost" size="sm" className="w-full text-xs" render={<Link href="/notifications" />}>View all</Button></div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
