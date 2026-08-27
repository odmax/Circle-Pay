"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Check,
  PiggyBank,
  ShoppingBag,
  Target,
  Calendar,
  Bell,
  Receipt,
  Shield,
  FolderKanban,
  AlertTriangle,
  Users,
  Settings,
  HandCoins,
  ScrollText,
  Landmark,
  Vote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { NoNotificationsEmpty } from "@/components/ui/app/empty-state-presets"

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  link: string | null
  createdAt: string
  circle: { id: string; name: string } | null
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONTRIBUTION_MADE: PiggyBank,
  CONTRIBUTION_PLAN_CREATED: PiggyBank,
  CONTRIBUTION_REMINDER: PiggyBank,
  EXPENSE_ADDED: ShoppingBag,
  GOAL_CREATED: Target,
  GOAL_ALLOCATION_ADDED: Target,
  GOAL_COMPLETED: Target,
  SETTLEMENT_REQUESTED: Receipt,
  SETTLEMENT_CONFIRMED: Receipt,
  SETTLEMENT_REJECTED: Receipt,
  NEW_MEMBER_JOINED: Users,
  EVENT_REMINDER: Calendar,
  RECEIPT_ISSUED: Receipt,
  RECEIPT_VOIDED: Receipt,
  RECEIPT_REPLACED: Receipt,
  APPROVAL_ASSIGNED: Shield,
  APPROVAL_STAGE_ACTIVATED: Shield,
  APPROVAL_STAGE_COMPLETED: Shield,
  APPROVAL_WORKFLOW_COMPLETED: Shield,
  APPROVAL_DELEGATED: Shield,
  APPROVAL_ESCALATED: Shield,
  APPROVAL_OVERDUE: Shield,
  PROJECT_CREATED: FolderKanban,
  FINANCIAL_RISK: AlertTriangle,
  PAYOUT_QUEUE_CREATED: HandCoins,
  PAYOUT_APPROACHING: HandCoins,
  PAYOUT_READY: HandCoins,
  PAYOUT_APPROVED: HandCoins,
  PAYOUT_PAID: HandCoins,
  PAYOUT_CONFIRMATION_REQUIRED: HandCoins,
  PAYOUT_QUEUE_CHANGED: HandCoins,
  PAYOUT_BLOCKED: HandCoins,
  PAYOUT_APPROVAL_REQUIRED: HandCoins,
  PAYOUT_CONFIRMED_RECEIVED: HandCoins,
  PAYOUT_DEFERRED: HandCoins,
  PAYOUT_SKIPPED: HandCoins,
  PAYOUT_SWAPPED: HandCoins,
  PAYOUT_ISSUE_REPORTED: HandCoins,
  PAYOUT_DRAW_COMPLETED: HandCoins,
  CONSTITUTION_PUBLISHED: ScrollText,
  CONSTITUTION_ACTIVATED: ScrollText,
  CONSTITUTION_SUPERSEDED: ScrollText,
  CONSTITUTION_ACCEPTANCE_REQUIRED: ScrollText,
  CONSTITUTION_ACCEPTANCE_OVERDUE: ScrollText,
  CONSTITUTION_AMENDMENT_PROPOSED: ScrollText,
  CONSTITUTION_AMENDMENT_APPROVED: ScrollText,
  CONSTITUTION_AMENDMENT_REJECTED: ScrollText,
  CONSTITUTION_RULE_CHANGED: ScrollText,
  CONSTITUTION_CONFLICT_DETECTED: AlertTriangle,
  CONSTITUTION_CONFLICT_RESOLVED: ScrollText,
  CONSTITUTION_MEMBER_ACCEPTED: ScrollText,
  MEETING_SCHEDULED: Landmark,
  MEETING_REMINDER: Landmark,
  MEETING_AGENDA_UPDATED: Landmark,
  MEETING_RSVP_RECEIVED: Users,
  VOTE_OPENED: Vote,
  VOTE_CLOSING_SOON: Vote,
  VOTE_RESULT: Vote,
  MINUTES_PUBLISHED: ScrollText,
  MINUTES_AMENDED: ScrollText,
  ACTION_ITEM_ASSIGNED: Users,
  QUORUM_REACHED: Users,
  QUORUM_LOST: AlertTriangle,
  GOV_DECISION_RECORDED: Landmark,
}

const TYPE_LABELS: Record<string, string> = {
  CONTRIBUTION_MADE: "Contribution",
  CONTRIBUTION_PLAN_CREATED: "Plan",
  CONTRIBUTION_REMINDER: "Reminder",
  EXPENSE_ADDED: "Expense",
  GOAL_CREATED: "Goal",
  GOAL_ALLOCATION_ADDED: "Goal",
  GOAL_COMPLETED: "Goal",
  SETTLEMENT_REQUESTED: "Settlement",
  SETTLEMENT_CONFIRMED: "Settlement",
  SETTLEMENT_REJECTED: "Settlement",
  NEW_MEMBER_JOINED: "Member",
  EVENT_REMINDER: "Event",
  RECEIPT_ISSUED: "Receipt",
  RECEIPT_VOIDED: "Receipt",
  RECEIPT_REPLACED: "Receipt",
  APPROVAL_ASSIGNED: "Approval",
  APPROVAL_STAGE_ACTIVATED: "Approval",
  APPROVAL_STAGE_COMPLETED: "Approval",
  APPROVAL_WORKFLOW_COMPLETED: "Approval",
  APPROVAL_DELEGATED: "Approval",
  APPROVAL_ESCALATED: "Approval",
  APPROVAL_OVERDUE: "Approval",
  PROJECT_CREATED: "Project",
  FINANCIAL_RISK: "Risk Alert",
  PAYOUT_QUEUE_CREATED: "Payout",
  PAYOUT_APPROACHING: "Payout",
  PAYOUT_READY: "Payout",
  PAYOUT_APPROVED: "Payout",
  PAYOUT_PAID: "Payout",
  PAYOUT_CONFIRMATION_REQUIRED: "Payout",
  PAYOUT_QUEUE_CHANGED: "Payout",
  PAYOUT_BLOCKED: "Payout",
  PAYOUT_APPROVAL_REQUIRED: "Payout",
  PAYOUT_CONFIRMED_RECEIVED: "Payout",
  PAYOUT_DEFERRED: "Payout",
  PAYOUT_SKIPPED: "Payout",
  PAYOUT_SWAPPED: "Payout",
  PAYOUT_ISSUE_REPORTED: "Payout",
  PAYOUT_DRAW_COMPLETED: "Payout",
  CONSTITUTION_PUBLISHED: "Constitution",
  CONSTITUTION_ACTIVATED: "Constitution",
  CONSTITUTION_SUPERSEDED: "Constitution",
  CONSTITUTION_ACCEPTANCE_REQUIRED: "Constitution",
  CONSTITUTION_ACCEPTANCE_OVERDUE: "Constitution",
  CONSTITUTION_AMENDMENT_PROPOSED: "Constitution",
  CONSTITUTION_AMENDMENT_APPROVED: "Constitution",
  CONSTITUTION_AMENDMENT_REJECTED: "Constitution",
  CONSTITUTION_RULE_CHANGED: "Constitution",
  CONSTITUTION_CONFLICT_DETECTED: "Constitution",
  CONSTITUTION_CONFLICT_RESOLVED: "Constitution",
  CONSTITUTION_MEMBER_ACCEPTED: "Constitution",
  MEETING_SCHEDULED: "Meetings & Voting",
  MEETING_REMINDER: "Meetings & Voting",
  MEETING_AGENDA_UPDATED: "Meetings & Voting",
  MEETING_RSVP_RECEIVED: "Meetings & Voting",
  VOTE_OPENED: "Meetings & Voting",
  VOTE_CLOSING_SOON: "Meetings & Voting",
  VOTE_RESULT: "Meetings & Voting",
  MINUTES_PUBLISHED: "Meetings & Voting",
  MINUTES_AMENDED: "Meetings & Voting",
  ACTION_ITEM_ASSIGNED: "Meetings & Voting",
  QUORUM_REACHED: "Meetings & Voting",
  QUORUM_LOST: "Meetings & Voting",
  GOV_DECISION_RECORDED: "Meetings & Voting",
}

const TYPE_GROUPS: Record<string, string[]> = {
  Contributions: [
    "CONTRIBUTION_MADE",
    "CONTRIBUTION_PLAN_CREATED",
    "CONTRIBUTION_REMINDER",
  ],
  Expenses: ["EXPENSE_ADDED"],
  Goals: ["GOAL_CREATED", "GOAL_ALLOCATION_ADDED", "GOAL_COMPLETED"],
  Settlements: [
    "SETTLEMENT_REQUESTED",
    "SETTLEMENT_CONFIRMED",
    "SETTLEMENT_REJECTED",
  ],
  Members: ["NEW_MEMBER_JOINED"],
  Events: ["EVENT_REMINDER"],
  Receipts: ["RECEIPT_ISSUED", "RECEIPT_VOIDED", "RECEIPT_REPLACED"],
  Approvals: [
    "APPROVAL_ASSIGNED",
    "APPROVAL_STAGE_ACTIVATED",
    "APPROVAL_STAGE_COMPLETED",
    "APPROVAL_WORKFLOW_COMPLETED",
    "APPROVAL_DELEGATED",
    "APPROVAL_ESCALATED",
    "APPROVAL_OVERDUE",
  ],
  Projects: ["PROJECT_CREATED"],
  Risks: ["FINANCIAL_RISK"],
  Payouts: [
    "PAYOUT_QUEUE_CREATED",
    "PAYOUT_APPROACHING",
    "PAYOUT_READY",
    "PAYOUT_APPROVED",
    "PAYOUT_PAID",
    "PAYOUT_CONFIRMATION_REQUIRED",
    "PAYOUT_QUEUE_CHANGED",
    "PAYOUT_BLOCKED",
    "PAYOUT_APPROVAL_REQUIRED",
    "PAYOUT_CONFIRMED_RECEIVED",
    "PAYOUT_DEFERRED",
    "PAYOUT_SKIPPED",
    "PAYOUT_SWAPPED",
    "PAYOUT_ISSUE_REPORTED",
    "PAYOUT_DRAW_COMPLETED",
  ],
  Constitution: [
    "CONSTITUTION_PUBLISHED",
    "CONSTITUTION_ACTIVATED",
    "CONSTITUTION_SUPERSEDED",
    "CONSTITUTION_ACCEPTANCE_REQUIRED",
    "CONSTITUTION_ACCEPTANCE_OVERDUE",
    "CONSTITUTION_AMENDMENT_PROPOSED",
    "CONSTITUTION_AMENDMENT_APPROVED",
    "CONSTITUTION_AMENDMENT_REJECTED",
    "CONSTITUTION_RULE_CHANGED",
    "CONSTITUTION_CONFLICT_DETECTED",
    "CONSTITUTION_CONFLICT_RESOLVED",
    "CONSTITUTION_MEMBER_ACCEPTED",
  ],
  Governance: [
    "MEETING_SCHEDULED",
    "MEETING_REMINDER",
    "MEETING_AGENDA_UPDATED",
    "MEETING_RSVP_RECEIVED",
    "VOTE_OPENED",
    "VOTE_CLOSING_SOON",
    "VOTE_RESULT",
    "MINUTES_PUBLISHED",
    "MINUTES_AMENDED",
    "ACTION_ITEM_ASSIGNED",
    "QUORUM_REACHED",
    "QUORUM_LOST",
    "GOV_DECISION_RECORDED",
  ],
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
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications || d || [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function markRead(id: string) {
    setActionLoading(id)
    await fetch(`/api/notifications/${id}/read`, { method: "POST" })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
    setActionLoading(null)
  }

  async function markAllRead() {
    setActionLoading("all")
    await fetch("/api/notifications/mark-all-read", { method: "POST" })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setActionLoading(null)
  }

  let filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications
  if (filter !== "all" && filter !== "unread") {
    const allowed = TYPE_GROUPS[filter] || []
    filtered = filtered.filter((n) => allowed.includes(n.type))
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const groups = groupByDate(filtered)
  const filterOptions = [
    "all",
    "unread",
    "Contributions",
    "Expenses",
    "Goals",
    "Settlements",
    "Members",
    "Events",
    "Receipts",
    "Approvals",
    "Projects",
    "Risks",
    "Payouts",
    "Constitution",
    "Governance",
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={markAllRead}
            disabled={actionLoading === "all"}
          >
            {actionLoading === "all" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            <span className="ml-1">Mark all read</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterOptions.map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="rounded-xl text-xs h-7"
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? "All"
              : f === "unread"
                ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`
                : f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <NoNotificationsEmpty />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                {group.label}
              </h2>
              <div className="space-y-1.5">
                {group.items.map((n) => {
                  const Icon = TYPE_ICONS[n.type]
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors hover:bg-muted/30",
                        !n.isRead
                          ? "border-brand-200 bg-brand-50/20"
                          : "border-border/40 bg-card"
                      )}
                      onClick={() => {
                        if (!n.isRead) markRead(n.id)
                        if (n.link) router.push(n.link)
                      }}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                        {Icon ? (
                          <Icon className="size-4 text-muted-foreground" />
                        ) : (
                          <Bell className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{n.title}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {TYPE_LABELS[n.type] || n.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.circle && (
                            <span className="text-[10px] text-brand font-medium">
                              {n.circle.name}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {!n.isRead && (
                        <div className="mt-1 size-2 rounded-full bg-brand shrink-0" />
                      )}
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
