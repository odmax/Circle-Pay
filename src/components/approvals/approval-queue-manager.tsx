"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  ArrowLeft,
  Settings,
  Loader2,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ApprovalStatsBar } from "./approval-stats-bar"
import { ApprovalDetailPanel } from "./approval-detail-panel"
import { useCirclePermissions } from "@/hooks/use-circle-permissions"
import {
  CIRCLE_PERMISSIONS,
  type CirclePermission,
} from "@/lib/permissions/circlePermissions"
import { toast } from "sonner"

type Decision = {
  id: string
  decision: string
  comment: string | null
  createdAt: string
  reviewer: { id: string; name: string | null; email?: string; image: string | null }
}

type ApprovalRequest = {
  id: string
  type: string
  status: string
  title: string
  description: string | null
  amount: number | null
  currency: string | null
  requestedAt: string
  expiresAt: string | null
  currentApprovals: number
  minimumApprovals: number
  isExpired: boolean
  approvalsNeeded: number
  requestedBy: { id: string; name: string | null; email?: string; image: string | null }
  decisions: Decision[]
}

type ApprovalStats = {
  pending: number
  approvedToday: number
  rejectedToday: number
  overdue: number
}

type ApprovalSettings = {
  enabled: boolean
  minimumApprovals: number
  allowedRoles: string[]
  ownerRequiredAboveAmount: number | null
  expiryDays: number | null
}

type CircleApprovalConfig = {
  contribution?: ApprovalSettings
  expense?: ApprovalSettings
  project?: ApprovalSettings
  walletWithdrawal?: ApprovalSettings
  settlement?: ApprovalSettings
}

type TimelineEvent = {
  type: string
  user: { id: string; name: string | null; email: string; image: string | null } | null
  timestamp: string
  comment: string | null
  metadata?: Record<string, unknown>
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "CONTRIBUTION", label: "Contribution" },
  { value: "EXPENSE", label: "Expense" },
  { value: "SETTLEMENT", label: "Settlement" },
  { value: "PROJECT", label: "Project" },
  { value: "WALLET_WITHDRAWAL", label: "Wallet Withdrawal" },
  { value: "WALLET_TRANSFER", label: "Wallet Transfer" },
  { value: "GOAL_WITHDRAWAL", label: "Goal Withdrawal" },
  { value: "JOIN_REQUEST", label: "Join Request" },
  { value: "MEMBER_PROMOTION", label: "Member Promotion" },
  { value: "OTHER", label: "Other" },
]

const STATUS_STYLES: Record<string, { className: string; icon: typeof Clock }> = {
  PENDING: { className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  APPROVED: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  REJECTED: { className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  CANCELLED: { className: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock },
  EXPIRED: { className: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
}

const TYPE_LABELS: Record<string, string> = {
  CONTRIBUTION: "Contribution",
  EXPENSE: "Expense",
  SETTLEMENT: "Settlement",
  PROJECT: "Project",
  WALLET_WITHDRAWAL: "Wallet Withdrawal",
  WALLET_TRANSFER: "Wallet Transfer",
  GOAL_WITHDRAWAL: "Goal Withdrawal",
  JOIN_REQUEST: "Join Request",
  MEMBER_PROMOTION: "Member Promotion",
  OTHER: "Other",
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

function getInitials(name: string | null): string {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  return "??"
}

export function ApprovalQueueManager({
  circleId,
  circleName,
  actorPermissions,
  actorUserId,
  initialPendingApprovals,
  initialStats,
  initialHistoryApprovals,
  historyTotal,
  historyHasMore,
  approvalConfig,
  hasReviewPermission,
}: {
  circleId: string
  circleName: string
  actorPermissions: CirclePermission[]
  actorUserId: string
  initialPendingApprovals: ApprovalRequest[]
  initialStats: ApprovalStats
  initialHistoryApprovals: ApprovalRequest[]
  historyTotal: number
  historyHasMore: boolean
  approvalConfig: CircleApprovalConfig
  hasReviewPermission: boolean
}) {
  const router = useRouter()
  const { can } = useCirclePermissions(actorPermissions)

  const [activeTab, setActiveTab] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [stats, setStats] = useState(initialStats)
  const [allApprovals, setAllApprovals] = useState<ApprovalRequest[]>(initialHistoryApprovals)
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>(initialPendingApprovals)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)

  const canManageSettings = can(CIRCLE_PERMISSIONS.SETTINGS_MANAGE)

  const filteredApprovals = allApprovals.filter((a) => {
    if (activeTab !== "all" && a.status !== activeTab) return false
    if (typeFilter !== "all" && a.type !== typeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        a.title.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q) ?? false) ||
        (a.requestedBy.name?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const refreshData = useCallback(async () => {
    try {
      const [pendingRes, statsRes, historyRes] = await Promise.all([
        fetch(`/api/circles/${circleId}/approvals?status=PENDING`),
        fetch(`/api/circles/${circleId}/approvals/stats`),
        fetch(`/api/circles/${circleId}/approvals?limit=50`),
      ])

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingApprovals(data.approvals ?? [])
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
      if (historyRes.ok) {
        const data = await historyRes.json()
        setAllApprovals(data.approvals ?? [])
      }
    } catch {
      router.refresh()
    }
  }, [circleId, router])

  async function handleQuickApprove(requestId: string) {
    setQuickLoading(requestId)
    try {
      const res = await fetch(`/api/circles/${circleId}/approvals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to approve")
        return
      }
      toast.success("Approved")
      await refreshData()
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(null)
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setQuickLoading(null)
    }
  }

  async function handleQuickReject(requestId: string) {
    setQuickLoading(requestId)
    try {
      const res = await fetch(`/api/circles/${circleId}/approvals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to reject")
        return
      }
      toast.success("Rejected")
      await refreshData()
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(null)
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setQuickLoading(null)
    }
  }

  async function handleSelectRequest(request: ApprovalRequest) {
    setSelectedRequest(request)
    setLoadingTimeline(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/approvals/${request.id}/timeline`)
      if (res.ok) {
        const data = await res.json()
        setTimelineEvents(data.events ?? [])
      }
    } catch {
      setTimelineEvents([])
    } finally {
      setLoadingTimeline(false)
    }
  }

  function canReviewRequest(request: ApprovalRequest): boolean {
    if (!hasReviewPermission) return false
    if (request.status !== "PENDING") return false
    if (request.requestedBy.id === actorUserId) return false
    if (request.decisions.some((d) => d.reviewer.id === actorUserId)) return false
    return true
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
            <p className="text-muted-foreground">{circleName}</p>
          </div>
        </div>
        {canManageSettings && (
          <Button render={<Link href={`/circles/${circleId}/manage/approvals/settings`} />} variant="outline" size="sm" className="rounded-xl">
            <Settings className="size-3 mr-1" />
            Settings
          </Button>
        )}
      </div>

      <ApprovalStatsBar stats={stats} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? "bg-brand text-white"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 w-full sm:w-48 rounded-lg text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="h-8 rounded-lg">
              <Filter className="size-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className={`flex-1 space-y-2 ${selectedRequest ? "hidden lg:block" : ""}`}>
          {filteredApprovals.length === 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="size-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No approvals found</p>
              </CardContent>
            </Card>
          )}

          {filteredApprovals.map((request) => {
            const statusStyle = STATUS_STYLES[request.status] ?? STATUS_STYLES.PENDING
            const StatusIcon = statusStyle.icon
            const isReviewable = canReviewRequest(request)
            const isLoading = quickLoading === request.id

            return (
              <div
                key={request.id}
                className={`rounded-2xl border border-border/40 bg-card p-4 cursor-pointer transition-all hover:border-brand/30 ${
                  selectedRequest?.id === request.id ? "ring-2 ring-brand/20 border-brand/40" : ""
                }`}
                onClick={() => handleSelectRequest(request)}
              >
                <div className="flex items-start gap-3">
                  <Avatar size="sm">
                    <AvatarImage src={request.requestedBy.image || ""} />
                    <AvatarFallback className="bg-brand-50 text-brand-700 text-xs">
                      {getInitials(request.requestedBy.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{request.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {request.requestedBy.name || request.requestedBy.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`border text-[10px] font-medium ${statusStyle.className}`}>
                          <StatusIcon className="size-2.5 mr-0.5" />
                          {request.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABELS[request.type] ?? request.type}
                      </Badge>
                      {request.amount != null && (
                        <span className="text-xs font-medium">
                          {request.currency ?? ""} {request.amount.toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTimeAgo(request.requestedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                (request.currentApprovals / Math.max(request.minimumApprovals, 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {request.currentApprovals}/{request.minimumApprovals}
                        </span>
                      </div>

                      {isReviewable && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="rounded-lg text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleQuickApprove(request.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="rounded-lg text-red-600 hover:bg-red-50"
                            onClick={() => handleQuickReject(request.id)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-3" />
                          </Button>
                        </div>
                      )}

                      {!isReviewable && (
                        <ChevronRight className="size-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {selectedRequest && (
          <div className="w-full lg:w-96 shrink-0">
            <Card className="rounded-2xl border-border/40 sticky top-4 overflow-hidden">
              {loadingTimeline ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ApprovalDetailPanel
                  request={selectedRequest}
                  timeline={timelineEvents}
                  circleId={circleId}
                  actorUserId={actorUserId}
                  canReview={canReviewRequest(selectedRequest)}
                  onClose={() => setSelectedRequest(null)}
                  onAction={async () => {
                    await refreshData()
                    setSelectedRequest(null)
                  }}
                />
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
