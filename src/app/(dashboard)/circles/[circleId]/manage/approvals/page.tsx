import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleMemberPermissions } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  getPendingApprovals,
  getApprovalStats,
  getApprovalHistory,
  getApprovalConfig,
} from "@/lib/services/approval.service"
import { ApprovalQueueManager } from "@/components/approvals/approval-queue-manager"

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  const [circle, actorPerms] = await Promise.all([
    getCircleById(circleId, session.user.id).catch(() => null),
    getCircleMemberPermissions({ userId: session.user.id, circleId }),
  ])

  if (!circle || !actorPerms) notFound()

  const [pendingApprovals, stats, approvalConfig, historyResult] = await Promise.all([
    getPendingApprovals(circleId),
    getApprovalStats(circleId),
    getApprovalConfig(circleId),
    getApprovalHistory(circleId, { limit: 50 }),
  ])

  const serializedPending = pendingApprovals.map((a) => ({
    ...a,
    requestedAt: a.requestedAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    approvedAt: a.approvedAt?.toISOString() ?? null,
    rejectedAt: a.rejectedAt?.toISOString() ?? null,
    decisions: a.decisions.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
  }))

  const serializedHistory = historyResult.requests.map((a) => ({
    ...a,
    requestedAt: a.requestedAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    approvedAt: a.approvedAt?.toISOString() ?? null,
    rejectedAt: a.rejectedAt?.toISOString() ?? null,
    isExpired: a.expiresAt ? new Date() > a.expiresAt : false,
    approvalsNeeded: a.minimumApprovals - a.currentApprovals,
    decisions: a.decisions.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
  }))

  const hasReviewPermission =
    actorPerms.permissions.includes(CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW) ||
    actorPerms.permissions.includes(CIRCLE_PERMISSIONS.EXPENSE_APPROVE) ||
    actorPerms.permissions.includes(CIRCLE_PERMISSIONS.PAYOUT_APPROVE)

  return (
    <ApprovalQueueManager
      circleId={circleId}
      circleName={circle.name}
      actorPermissions={actorPerms.permissions}
      actorUserId={session.user.id}
      initialPendingApprovals={serializedPending}
      initialStats={stats}
      initialHistoryApprovals={serializedHistory}
      historyTotal={historyResult.total}
      historyHasMore={historyResult.hasMore}
      approvalConfig={approvalConfig}
      hasReviewPermission={hasReviewPermission}
    />
  )
}
