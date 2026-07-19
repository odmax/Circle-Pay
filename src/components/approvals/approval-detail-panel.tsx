"use client"

import { useState } from "react"
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { ApprovalTimeline } from "./approval-timeline"
import { StageProgressIndicator } from "./stage-progress-indicator"
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
  workflowSnapshot?: { workflowId: string; workflowName: string; workflowVersion: number; stagesCount: number } | null
  stages?: Array<{
    id: string
    name: string
    order: number
    mode: string
    status: string
    minimumApprovals: number
    totalReviewers: number
    decidedCount: number
    approvedCount: number
    rejectedCount: number
    reviewers: Array<{
      id: string
      memberId: string
      required: boolean
      delegatedFromMemberId: string | null
      member: { id: string; name: string | null; email: string; image: string | null }
    }>
    decisions: Array<{
      id: string
      decision: string
      comment: string | null
      createdAt: string
      reviewer: { id: string; name: string | null; email: string; image: string | null }
    }>
  }> | null
  requestedBy: { id: string; name: string | null; email?: string; image: string | null }
  decisions: Decision[]
}

type TimelineEvent = {
  type: string
  user: { id: string; name: string | null; email: string; image: string | null } | null
  timestamp: string
  comment: string | null
  metadata?: Record<string, unknown>
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  CANCELLED: { label: "Cancelled", className: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock },
  EXPIRED: { label: "Expired", className: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
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

function getInitials(name: string | null, email?: string): string {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  return "??"
}

export function ApprovalDetailPanel({
  request,
  timeline,
  circleId,
  actorUserId,
  canReview,
  onClose,
  onAction,
}: {
  request: ApprovalRequest
  timeline: TimelineEvent[]
  circleId: string
  actorUserId: string
  canReview: boolean
  onClose: () => void
  onAction: () => void
}) {
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState<"approve" | "reject" | "cancel" | null>(null)
  const [showTimeline, setShowTimeline] = useState(false)

  const statusConfig = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING
  const StatusIcon = statusConfig.icon
  const isPending = request.status === "PENDING"
  const isRequester = request.requestedBy.id === actorUserId
  const hasVoted = request.decisions.some((d) => d.reviewer.id === actorUserId)
  const canCancel = isPending && (isRequester || canReview)
  const canAct = isPending && canReview && !hasVoted && !isRequester

  async function handleAction(action: "approve" | "reject") {
    setLoading(action)
    try {
      const activeStage = request.stages?.find((s) => s.status === "ACTIVE")
      const res = await fetch(`/api/circles/${circleId}/approvals/${request.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: action === "approve" ? "APPROVE" : "REJECT",
          comment: comment || undefined,
          requestStageId: activeStage?.id || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || `Failed to ${action}`)
        return
      }
      toast.success(action === "approve" ? "Approved" : "Rejected")
      setComment("")
      onAction()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(null)
    }
  }

  async function handleCancel() {
    setLoading("cancel")
    try {
      const res = await fetch(`/api/circles/${circleId}/approvals/${request.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to cancel")
        return
      }
      toast.success("Request cancelled")
      onAction()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="text-sm font-semibold truncate pr-2">{request.title}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-lg"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`border text-xs font-medium ${statusConfig.className}`}>
              <StatusIcon className="size-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABELS[request.type] ?? request.type}
            </Badge>
          </div>

          {request.description && (
            <p className="text-sm text-muted-foreground">{request.description}</p>
          )}

          {request.workflowSnapshot && (
            <div className="rounded-xl bg-muted/30 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">
                Workflow: {request.workflowSnapshot.workflowName} (v{request.workflowSnapshot.workflowVersion})
              </p>
            </div>
          )}

          {request.amount != null && (
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-lg font-bold">
                {request.currency ?? ""} {request.amount.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/40 p-3">
          <p className="text-xs text-muted-foreground mb-2">Requested by</p>
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={request.requestedBy.image || ""} />
              <AvatarFallback className="bg-brand-50 text-brand-700 text-xs">
                {getInitials(request.requestedBy.name, request.requestedBy.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {request.requestedBy.name || request.requestedBy.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTimeAgo(request.requestedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Approval Progress</p>
            <p className="text-xs font-medium">
              {request.currentApprovals} of {request.minimumApprovals}
            </p>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (request.currentApprovals / request.minimumApprovals) * 100,
                  100
                )}%`,
              }}
            />
          </div>
          {request.approvalsNeeded > 0 && isPending && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {request.approvalsNeeded} more approval{request.approvalsNeeded !== 1 ? "s" : ""} needed
            </p>
          )}
        </div>

        {request.expiresAt && isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>
              {request.isExpired
                ? "Expired"
                : `Expires ${formatTimeAgo(request.expiresAt)}`}
            </span>
          </div>
        )}

        {request.stages && request.stages.length > 0 && (
          <div className="rounded-xl border border-border/40 p-3">
            <StageProgressIndicator stages={request.stages as any} />
          </div>
        )}

        {request.decisions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Decisions</p>
            {request.decisions.map((decision) => {
              const initials = getInitials(decision.reviewer.name, decision.reviewer.email)
              return (
                <div
                  key={decision.id}
                  className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2"
                >
                  <Avatar size="sm">
                    <AvatarImage src={decision.reviewer.image || ""} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {decision.reviewer.name || decision.reviewer.email}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          decision.decision === "APPROVE"
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px]"
                            : "border-red-200 text-red-700 bg-red-50 text-[10px]"
                        }
                      >
                        {decision.decision === "APPROVE" ? "Approved" : "Rejected"}
                      </Badge>
                    </div>
                    {decision.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {decision.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {formatTimeAgo(decision.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowTimeline(!showTimeline)}
          >
            {showTimeline ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Timeline
          </button>
          {showTimeline && (
            <div className="mt-3">
              <ApprovalTimeline events={timeline} />
            </div>
          )}
        </div>
      </div>

      {(canAct || canCancel) && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {canAct && (
            <>
              <Textarea
                placeholder="Add a comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[60px] rounded-xl text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleAction("approve")}
                  disabled={loading !== null}
                >
                  {loading === "approve" ? (
                    <Clock className="size-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="size-3 mr-1" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={() => handleAction("reject")}
                  disabled={loading !== null}
                >
                  {loading === "reject" ? (
                    <Clock className="size-3 animate-spin mr-1" />
                  ) : (
                    <XCircle className="size-3 mr-1" />
                  )}
                  Reject
                </Button>
              </div>
            </>
          )}
          {canCancel && !canAct && (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl text-muted-foreground"
              onClick={handleCancel}
              disabled={loading !== null}
            >
              {loading === "cancel" ? (
                <Clock className="size-3 animate-spin mr-1" />
              ) : (
                <XCircle className="size-3 mr-1" />
              )}
              Cancel Request
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
