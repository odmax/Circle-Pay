"use client"

import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type StageReviewer = {
  id: string
  memberId: string
  required: boolean
  delegatedFromMemberId: string | null
  notifiedAt: string | null
  actedAt: string | null
  member: { id: string; name: string | null; email: string; image: string | null }
}

type StageDecision = {
  id: string
  decision: string
  comment: string | null
  createdAt: string
  reviewer: { id: string; name: string | null; email: string; image: string | null }
}

type StageData = {
  id: string
  name: string
  order: number
  mode: string
  status: string
  minimumApprovals: number
  rejectionThreshold: number | null
  requireAllReviewers: boolean
  activatedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  totalReviewers: number
  decidedCount: number
  approvedCount: number
  rejectedCount: number
  reviewers: StageReviewer[]
  decisions: StageDecision[]
}

const STAGE_STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  WAITING: { label: "Waiting", className: "bg-gray-50 text-gray-500 border-gray-200", icon: Clock },
  ACTIVE: { label: "Active", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  SKIPPED: { label: "Skipped", className: "bg-gray-50 text-gray-400 border-gray-200", icon: Clock },
  EXPIRED: { label: "Expired", className: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", className: "bg-gray-50 text-gray-500 border-gray-200", icon: Clock },
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString()
}

export function StageProgressIndicator({ stages }: { stages: StageData[] }) {
  if (!stages || stages.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Workflow Stages</p>
      <div className="relative">
        {stages.map((stage, index) => {
          const statusCfg = STAGE_STATUS_CONFIG[stage.status] ?? STAGE_STATUS_CONFIG.WAITING
          const StatusIcon = statusCfg.icon
          const isActive = stage.status === "ACTIVE"
          const isLast = index === stages.length - 1

          return (
            <div key={stage.id} className="relative flex gap-3 pb-4">
              {/* Connector line */}
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-6 w-0.5 h-[calc(100%-12px)] ${
                    stage.status === "APPROVED" ? "bg-emerald-300" :
                    stage.status === "REJECTED" ? "bg-red-300" :
                    "bg-border/60"
                  }`}
                />
              )}

              {/* Stage indicator */}
              <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 ${
                stage.status === "APPROVED" ? "bg-emerald-100 border-emerald-300" :
                stage.status === "REJECTED" ? "bg-red-100 border-red-300" :
                stage.status === "ACTIVE" ? "bg-blue-100 border-blue-300" :
                "bg-muted border-border/60"
              }`}>
                {stage.status === "APPROVED" ? (
                  <CheckCircle2 className="size-3 text-emerald-600" />
                ) : stage.status === "REJECTED" ? (
                  <XCircle className="size-3 text-red-600" />
                ) : stage.status === "ACTIVE" ? (
                  <Loader2 className="size-3 text-blue-600 animate-spin" />
                ) : (
                  <span className="text-[8px] font-bold text-muted-foreground">{stage.order}</span>
                )}
              </div>

              {/* Stage content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{stage.name}</span>
                  <Badge variant="outline" className={`border text-[9px] ${statusCfg.className}`}>
                    <StatusIcon className={`size-2 mr-0.5 ${isActive ? "animate-spin" : ""}`} />
                    {statusCfg.label}
                  </Badge>
                  {stage.mode === "PARALLEL" && (
                    <Badge variant="secondary" className="text-[9px]">Parallel</Badge>
                  )}
                </div>

                {/* Progress */}
                {stage.status === "ACTIVE" && stage.totalReviewers > 0 && (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              (stage.approvedCount / Math.max(stage.minimumApprovals, 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {stage.approvedCount}/{stage.minimumApprovals} needed
                      </span>
                    </div>
                  </div>
                )}

                {/* Reviewer chips */}
                {stage.reviewers.length > 0 && stage.status !== "WAITING" && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {stage.reviewers.map((reviewer) => {
                      const decision = stage.decisions.find((d) => d.reviewer.id === reviewer.memberId)
                      const isDelegated = !!reviewer.delegatedFromMemberId

                      return (
                        <div
                          key={reviewer.id}
                          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] border ${
                            decision?.decision === "APPROVE"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : decision?.decision === "REJECT"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "bg-muted/50 border-border/40 text-muted-foreground"
                          }`}
                        >
                          <Avatar size="sm" className="!size-3.5">
                            <AvatarImage src={reviewer.member.image || ""} />
                            <AvatarFallback className="text-[6px]">
                              {reviewer.member.name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[60px]">
                            {reviewer.member.name?.split(" ")[0] || "?"}
                          </span>
                          {isDelegated && (
                            <span className="text-[8px] text-amber-500" title={`Delegated by ${reviewer.delegatedFromMemberId}`}>
                              (d)
                            </span>
                          )}
                          {decision && (
                            decision.decision === "APPROVE" ? (
                              <CheckCircle2 className="size-2" />
                            ) : (
                              <XCircle className="size-2" />
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Stage decisions summary */}
                {stage.decisions.length > 0 && stage.status !== "ACTIVE" && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {stage.approvedCount} approved, {stage.rejectedCount} rejected
                    {stage.completedAt && ` · ${formatTimeAgo(stage.completedAt)}`}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
