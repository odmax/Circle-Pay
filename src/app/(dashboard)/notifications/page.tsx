"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Check, PiggyBank, ShoppingBag, Target, Wallet, Calendar, BarChart3, Bell, MessageCircle, Megaphone, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { NoNotificationsEmpty } from "@/components/ui/app/empty-state-presets"

interface NotificationItem {
  id: string; type: string; title: string; message: string; isRead: boolean; link: string | null; createdAt: string; circle: { id: string; name: string } | null
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONTRIBUTION_MADE: PiggyBank, CONTRIBUTION_PLAN_CREATED: PiggyBank,
  EXPENSE_ADDED: ShoppingBag,
  GOAL_CREATED: Target, GOAL_ALLOCATION_ADDED: Target, GOAL_COMPLETED: Target,
  WALLET_TRANSACTION: Wallet, WALLET_APPROVAL: Wallet,
  EVENT_REMINDER: Calendar, EVENT_RSVP: Calendar,
  POLL_CREATED: BarChart3, POLL_CLOSED: BarChart3,
  CONTRIBUTION_REMINDER: Bell,
  SUPPORT_REPLY: MessageCircle, SUPPORT_NEW: MessageCircle,
  BROADCAST: Megaphone,
  SYSTEM: Settings,
}

const TYPE_LABELS: Record<string, string> = {
  CONTRIBUTION_MADE: "Contribution", CONTRIBUTION_PLAN_CREATED: "Plan",
  EXPENSE_ADDED: "Expense",
  GOAL_CREATED: "Goal", GOAL_ALLOCATION_ADDED: "Goal", GOAL_COMPLETED: "Goal",
  WALLET_TRANSACTION: "Wallet", WALLET_APPROVAL: "Wallet",
  EVENT_REMINDER: "Event", EVENT_RSVP: "Event",
  POLL_CREATED: "Poll", POLL_CLOSED: "Poll",
  CONTRIBUTION_REMINDER: "System", SUPPORT_REPLY: "Support", SUPPORT_NEW: "Support",
  BROADCAST: "Broadcast", SYSTEM: "System",
}

const TYPE_GROUPS: Record<string, string[]> = {
  Contributions: ["CONTRIBUTION_MADE", "CONTRIBUTION_PLAN_CREATED", "CONTRIBUTION_REMINDER"],
  Expenses: ["EXPENSE_ADDED"],
  Goals: ["GOAL_CREATED", "GOAL_ALLOCATION_ADDED", "GOAL_COMPLETED"],
  Wallet: ["WALLET_TRANSACTION", "WALLET_APPROVAL"],
  Events: ["EVENT_REMINDER", "EVENT_RSVP"],
  Polls: ["POLL_CREATED", "POLL_CLOSED"],
  Support: ["SUPPORT_REPLY", "SUPPORT_NEW"],
  Broadcasts: ["BROADCAST"],
  System: ["SYSTEM"],
}

function groupByDate(items: NotificationItem[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000)

  const groups: { label: string; items: NotificationItem[] }[] = []
  const today: NotificationItem[] = []
  const yesterday: NotificationItem[] = []
  const thisWeek: NotificationItem[] = []
  const older: NotificationItem[] = []

  for (const n of items) {
    const d = new Date(n.createdAt)
    if (d >= todayStart) today.push(n)
    else if (d >= yesterdayStart) yesterday.push(n)
    else if (d >= weekStart) thisWeek.push(n)
    else older.push(n)
  }
  if (today.length) groups.push({ label: "Today", items: today })
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday })
  if (thisWeek.length) groups.push({ label: "This Week", items: thisWeek })
  if (older.length) groups.push({ label: "Older", items: older })
  return groups
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => { setNotifications(d.notifications || d || []) }).finally(() => setLoading(false))
  }, [])

  async function markRead(id: string) {
    setActionLoading(id)
    await fetch(`/api/notifications/${id}/read`, { method: "POST" })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setActionLoading(null)
  }

  async function markAllRead() {
    setActionLoading("all")
    await fetch("/api/notifications/mark-all-read", { method: "POST" })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setActionLoading(null)
  }

  let filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications
  if (filter !== "all" && filter !== "unread") {
    const allowed = TYPE_GROUPS[filter] || []
    filtered = filtered.filter((n) => allowed.includes(n.type))
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const groups = groupByDate(filtered)
  const filterOptions = ["all", "unread", "Contributions", "Expenses", "Goals", "Wallet", "Events", "Polls", "Support", "Broadcasts", "System"]

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Notifications</h1><p className="text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}</p></div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={markAllRead} disabled={actionLoading === "all"}>
            {actionLoading === "all" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}<span className="ml-1">Mark all read</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterOptions.map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="rounded-xl text-xs h-7" onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "unread" ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` : f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? <NoNotificationsEmpty /> : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">{group.label}</h2>
              <div className="space-y-1.5">
                {group.items.map((n) => {
                  const Icon = TYPE_ICONS[n.type]
                  return (
                    <div key={n.id} className={cn("flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors hover:bg-muted/30", !n.isRead ? "border-brand-200 bg-brand-50/20" : "border-border/40 bg-card")}
                      onClick={() => { if (!n.isRead) markRead(n.id); if (n.link) router.push(n.link) }}>
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                        {Icon ? <Icon className="size-4 text-muted-foreground" /> : <Bell className="size-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><p className="text-sm font-medium">{n.title}</p><Badge variant="outline" className="text-[10px]">{TYPE_LABELS[n.type] || n.type}</Badge></div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.circle && <span className="text-[10px] text-brand font-medium">{n.circle.name}</span>}
                          <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      {!n.isRead && <div className="mt-1 size-2 rounded-full bg-brand shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
