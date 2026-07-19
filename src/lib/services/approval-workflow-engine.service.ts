import { prisma } from "@/lib/prisma"
import type {
  ApprovalStatus,
  ApprovalStageRuntimeStatus,
  ApprovalDecision,
} from "@/generated/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification } from "@/lib/services/notification.service"
import {
  selectWorkflowForRequest,
  buildWorkflowSnapshot,
} from "./approval-workflow.service"

// ─── Internal Event System ────────────────────────────────
// Lightweight in-process event emitter. In future phases this
// will integrate with an external event bus.

export type WorkflowEventType =
  | "WORKFLOW_INITIALIZED"
  | "STAGE_ACTIVATED"
  | "STAGE_COMPLETED"
  | "STAGE_REJECTED"
  | "STAGE_ESCALATED"
  | "STAGE_EXPIRED"
  | "DECISION_RECORDED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_REJECTED"
  | "WORKFLOW_EXPIRED"

export interface WorkflowEvent {
  type: WorkflowEventType
  circleId: string
  requestId: string
  stageId?: string
  reviewerId?: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

type EventHandler = (event: WorkflowEvent) => void | Promise<void>

const eventHandlers: EventHandler[] = []

export function onWorkflowEvent(handler: EventHandler) {
  eventHandlers.push(handler)
  return () => {
    const idx = eventHandlers.indexOf(handler)
    if (idx >= 0) eventHandlers.splice(idx, 1)
  }
}

async function emitEvent(event: WorkflowEvent) {
  for (const handler of eventHandlers) {
    try {
      await handler(event)
    } catch (err) {
      console.error(`Workflow event handler error for ${event.type}:`, err)
    }
  }
}

// ─── 1. Initialise Approval with Workflow ────────────────
// Resolves the matching workflow, builds an immutable snapshot,
// creates runtime stages, activates the first one.

export async function initialiseApprovalWorkflow(params: {
  circleId: string
  requestId: string
  type: string
  amount?: number | null
  currency?: string | null
  createdById: string
}) {
  const { circleId, requestId, type, amount, currency } = params

  const workflow = await selectWorkflowForRequest({
    circleId,
    type: type as any,
    amount,
    currency,
  })
  if (!workflow) return null

  const snapshot = buildWorkflowSnapshot(workflow)

  const runtimeStages = await prisma.$transaction(async (tx) => {
    const stages = []

    for (const wfStage of workflow.stages) {
      const resolvedReviewers = await resolveStageReviewers(tx, circleId, wfStage, requestId)

      if (resolvedReviewers.length === 0) continue

      const runtimeStage = await tx.approvalRequestStage.create({
        data: {
          approvalRequestId: requestId,
          workflowStageId: wfStage.id,
          name: wfStage.name,
          order: wfStage.order,
          mode: wfStage.mode,
          status: "WAITING",
          minimumApprovals: wfStage.minimumApprovals,
          rejectionThreshold: wfStage.rejectionThreshold,
          requireAllReviewers: wfStage.requireAllReviewers,
          ownerRequired: wfStage.ownerRequired,
          expiresAt: wfStage.expiresAfterHours
            ? new Date(Date.now() + wfStage.expiresAfterHours * 60 * 60 * 1000)
            : null,
          reviewers: {
            create: resolvedReviewers.map((r) => ({
              memberId: r.memberId,
              required: r.required,
              delegatedFromMemberId: r.delegatedFromMemberId || null,
            })),
          },
        },
        include: { reviewers: true },
      })

      stages.push(runtimeStage)
    }

    await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        workflowSnapshot: snapshot as any,
        currentStageId: stages.length > 0 ? stages[0].id : null,
      },
    })

    if (stages.length > 0) {
      await tx.approvalRequestStage.update({
        where: { id: stages[0].id },
        data: { status: "ACTIVE", activatedAt: new Date() },
      })

      for (const reviewer of stages[0].reviewers) {
        createNotification({
          userId: reviewer.memberId,
          circleId,
          type: "APPROVAL_ASSIGNED",
          title: `Review required: ${type.replace(/_/g, " ")}`,
          message: `You have been assigned as a reviewer in stage "${stages[0].name}".`,
          link: `/circles/${circleId}/approvals`,
        }).catch(console.error)
      }
    }

    return stages
  })

  await emitEvent({
    type: "WORKFLOW_INITIALIZED",
    circleId,
    requestId,
    stageId: runtimeStages[0]?.id,
    timestamp: new Date(),
    metadata: { workflowId: workflow.id, stagesCount: runtimeStages.length },
  })

  return { workflow, runtimeStages }
}

// ─── 2. Resolve Stage Reviewers ──────────────────────────
// Resolves ROLE/MEMBER/PERMISSION reviewer types into concrete
// member IDs. Checks delegation for each resolved member.

async function resolveStageReviewers(
  tx: any,
  circleId: string,
  wfStage: any,
  requestId: string
): Promise<
  Array<{
    memberId: string
    required: boolean
    delegatedFromMemberId?: string | null
  }>
> {
  const reviewers: Array<{
    memberId: string
    required: boolean
    delegatedFromMemberId?: string | null
  }> = []
  const seen = new Set<string>()
  const occupiedSlots = new Set<string>()

  for (const wfReviewer of wfStage.reviewers) {
    let candidateIds: string[] = []

    if (wfReviewer.reviewerType === "MEMBER" && wfReviewer.memberId) {
      candidateIds = [wfReviewer.memberId]
    } else if (wfReviewer.reviewerType === "ROLE" && wfReviewer.role) {
      const members = await tx.circleMember.findMany({
        where: { circleId, role: wfReviewer.role as any },
        select: { userId: true },
      })
      candidateIds = members.map((m: any) => m.userId)
    } else if (wfReviewer.reviewerType === "PERMISSION" && wfReviewer.permission) {
      const members = await tx.circleMember.findMany({
        where: { circleId },
        select: {
          userId: true,
          role: true,
          permissions: { select: { permission: true, granted: true } },
        },
      })
      candidateIds = members
        .filter((m: any) =>
          m.permissions.some(
            (p: any) => p.permission === wfReviewer.permission && p.granted
          )
        )
        .map((m: any) => m.userId)
    }

    for (const memberId of candidateIds) {
      if (seen.has(memberId)) continue

      // Deduplication: prevent same person occupying multiple mandatory slots
      const slotKey = `${wfReviewer.reviewerType}:${wfReviewer.role || wfReviewer.memberId || wfReviewer.permission}`
      if (wfReviewer.required && occupiedSlots.has(slotKey)) continue
      if (wfReviewer.required) occupiedSlots.add(slotKey)

      seen.add(memberId)

      // Check for delegation
      const delegation = await tx.approvalDelegation.findFirst({
        where: {
          circleId,
          delegateMemberId: memberId,
          status: "ACTIVE",
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() },
        },
      })

      reviewers.push({
        memberId,
        required: wfReviewer.required,
        delegatedFromMemberId: delegation ? delegation.delegatorMemberId : null,
      })
    }
  }

  return reviewers
}

// ─── 3. Record Decision ──────────────────────────────────
// Validates stage state, reviewer assignment, self-approval,
// and delegation before recording a decision. All inside a
// single Prisma transaction.

export async function recordDecision(params: {
  approvalRequestId: string
  requestStageId: string
  reviewerId: string
  decision: "APPROVE" | "REJECT"
  comment?: string | null
}) {
  const { approvalRequestId, requestStageId, reviewerId, decision, comment } = params

  return await prisma.$transaction(async (tx) => {
    // Load request
    const request = await tx.approvalRequest.findUnique({
      where: { id: approvalRequestId },
    })
    if (!request) throw new Error("Approval request not found")
    if (request.status !== "PENDING") throw new Error("Approval request is not pending")
    if (request.expiresAt && new Date() > request.expiresAt) {
      throw new Error("Approval request has expired")
    }

    // Load stage
    const stage = await tx.approvalRequestStage.findUnique({
      where: { id: requestStageId },
      include: { reviewers: true },
    })
    if (!stage) throw new Error("Request stage not found")
    if (stage.status !== "ACTIVE") throw new Error("Stage is not active")
    if (stage.approvalRequestId !== approvalRequestId) {
      throw new Error("Stage does not belong to this request")
    }

    // Verify reviewer is assigned
    const assignedReviewer = stage.reviewers.find((r) => r.memberId === reviewerId)
    if (!assignedReviewer) {
      throw new Error("You are not assigned as a reviewer for this stage")
    }

    // Check no duplicate decision on this stage
    const existingDecision = await tx.approvalRequestDecision.findFirst({
      where: { approvalRequestId, requestStageId, reviewerId },
    })
    if (existingDecision) throw new Error("You have already voted on this stage")

    // Self-approval check
    let allowSelfApproval = false
    if (stage.workflowStageId) {
      const wfStage = await tx.approvalWorkflowStage.findUnique({
        where: { id: stage.workflowStageId },
        select: { allowSelfApproval: true },
      })
      allowSelfApproval = wfStage?.allowSelfApproval ?? false
    }

    if (!allowSelfApproval && request.requestedById === reviewerId) {
      throw new Error("Self-approval is not allowed for this stage")
    }

    // Delegation validation: delegated reviewer must have active delegation
    if (assignedReviewer.delegatedFromMemberId) {
      const delegation = await tx.approvalDelegation.findFirst({
        where: {
          circleId: request.circleId,
          delegatorMemberId: assignedReviewer.delegatedFromMemberId,
          delegateMemberId: reviewerId,
          status: "ACTIVE",
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() },
        },
      })
      if (!delegation) {
        throw new Error("Delegation has expired or is invalid")
      }
    }

    // Create decision
    const newDecision = await tx.approvalRequestDecision.create({
      data: {
        approvalRequestId,
        requestStageId,
        reviewerId,
        originalReviewerId:
          assignedReviewer.delegatedFromMemberId || reviewerId,
        delegatedReviewerId: assignedReviewer.delegatedFromMemberId
          ? reviewerId
          : null,
        decision: decision as ApprovalDecision,
        comment: comment || null,
        source: assignedReviewer.delegatedFromMemberId
          ? "DELEGATION"
          : "DIRECT",
        actedAt: new Date(),
      },
    })

    await emitEvent({
      type: "DECISION_RECORDED",
      circleId: request.circleId,
      requestId: approvalRequestId,
      stageId: requestStageId,
      reviewerId,
      timestamp: new Date(),
      metadata: {
        decision,
        source: assignedReviewer.delegatedFromMemberId
          ? "DELEGATION"
          : "DIRECT",
      },
    })

    // Evaluate stage
    const evaluation = await evaluateStage(tx, stage, request, decision)

    return { decision: newDecision, ...evaluation }
  })
}

// ─── 4. Evaluate Stage ───────────────────────────────────
// Determines if a stage is complete based on decisions so far.
// Returns stageComplete + stageResult + what happens next.

async function evaluateStage(
  tx: any,
  stage: any,
  request: any,
  decision: string
): Promise<{
  stageComplete: boolean
  stageResult: "APPROVED" | "REJECTED" | null
  workflowComplete: boolean
  workflowRejected: boolean
}> {
  const stageDecisions = await tx.approvalRequestDecision.findMany({
    where: { requestStageId: stage.id },
  })

  const approvals = stageDecisions.filter(
    (d: any) => d.decision === "APPROVE"
  ).length
  const rejections = stageDecisions.filter(
    (d: any) => d.decision === "REJECT"
  ).length
  const totalDecisions = stageDecisions.length
  const totalReviewers = stage.reviewers.length

  let stageComplete = false
  let stageResult: "APPROVED" | "REJECTED" | null = null

  if (decision === "REJECT") {
    // Rejection evaluation
    if (
      stage.rejectionThreshold &&
      rejections >= stage.rejectionThreshold
    ) {
      stageComplete = true
      stageResult = "REJECTED"
    } else if (stage.requireAllReviewers && totalDecisions === totalReviewers) {
      stageComplete = true
      stageResult = "REJECTED"
    } else if (
      !stage.rejectionThreshold &&
      !stage.requireAllReviewers &&
      rejections > 0
    ) {
      // Single rejection kills it
      stageComplete = true
      stageResult = "REJECTED"
    }
  } else {
    // Approval evaluation
    if (stage.mode === "PARALLEL" && stage.requireAllReviewers) {
      if (approvals >= totalReviewers) {
        stageComplete = true
        stageResult = "APPROVED"
      }
    } else {
      if (approvals >= stage.minimumApprovals) {
        stageComplete = true
        stageResult = "APPROVED"
      }
    }
  }

  if (!stageComplete) {
    await tx.approvalRequest.update({
      where: { id: request.id },
      data: { currentApprovals: request.currentApprovals + 1 },
    })
    return {
      stageComplete: false,
      stageResult: null,
      workflowComplete: false,
      workflowRejected: false,
    }
  }

  // Stage is complete — update it
  await tx.approvalRequestStage.update({
    where: { id: stage.id },
    data: {
      status: stageResult as ApprovalStageRuntimeStatus,
      completedAt: new Date(),
    },
  })

  await emitEvent({
    type:
      stageResult === "APPROVED" ? "STAGE_COMPLETED" : "STAGE_REJECTED",
    circleId: request.circleId,
    requestId: request.id,
    stageId: stage.id,
    timestamp: new Date(),
    metadata: { stageResult, stageName: stage.name },
  })

  if (stageResult === "REJECTED") {
    // Reject entire workflow
    await cancelRemainingStages(tx, request.id, stage.id)

    await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED" as ApprovalStatus,
        rejectedAt: new Date(),
        completedAt: new Date(),
        currentStageId: null,
      },
    })

    await emitEvent({
      type: "WORKFLOW_REJECTED",
      circleId: request.circleId,
      requestId: request.id,
      stageId: stage.id,
      timestamp: new Date(),
      metadata: { rejectedAtStage: stage.name },
    })

    return {
      stageComplete: true,
      stageResult: "REJECTED",
      workflowComplete: false,
      workflowRejected: true,
    }
  }

  // Stage approved — find and activate next
  const nextStage = await tx.approvalRequestStage.findFirst({
    where: { approvalRequestId: request.id, status: "WAITING" },
    orderBy: { order: "asc" },
  })

  if (nextStage) {
    // Sequential mode: activate next
    await tx.approvalRequestStage.update({
      where: { id: nextStage.id },
      data: { status: "ACTIVE", activatedAt: new Date() },
    })
    await tx.approvalRequest.update({
      where: { id: request.id },
      data: { currentStageId: nextStage.id },
    })

    // Notify new stage reviewers
    const nextStageWithReviewers = await tx.approvalRequestStage.findUnique({
      where: { id: nextStage.id },
      include: { reviewers: true },
    })
    if (nextStageWithReviewers) {
      for (const reviewer of nextStageWithReviewers.reviewers) {
        createNotification({
          userId: reviewer.memberId,
          circleId: request.circleId,
          type: "APPROVAL_STAGE_ACTIVATED",
          title: `New stage active: ${nextStage.name}`,
          message: `Stage "${nextStage.name}" is now active and awaiting your review.`,
          link: `/circles/${request.circleId}/approvals`,
        }).catch(console.error)
      }
    }

    await emitEvent({
      type: "STAGE_ACTIVATED",
      circleId: request.circleId,
      requestId: request.id,
      stageId: nextStage.id,
      timestamp: new Date(),
      metadata: { stageName: nextStage.name },
    })

    return {
      stageComplete: true,
      stageResult: "APPROVED",
      workflowComplete: false,
      workflowRejected: false,
    }
  }

  // All stages complete — workflow approved
  await tx.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED" as ApprovalStatus,
      approvedAt: new Date(),
      completedAt: new Date(),
      currentStageId: null,
      currentApprovals: request.currentApprovals + 1,
    },
  })

  await emitEvent({
    type: "WORKFLOW_COMPLETED",
    circleId: request.circleId,
    requestId: request.id,
    timestamp: new Date(),
  })

  return {
    stageComplete: true,
    stageResult: "APPROVED",
    workflowComplete: true,
    workflowRejected: false,
  }
}

// ─── 5. Process Stage Decision (with notifications) ─────
// Public wrapper around recordDecision that sends post-transaction
// notifications. This is what the API route calls.

export async function processStageDecision(params: {
  approvalRequestId: string
  requestStageId: string
  reviewerId: string
  decision: "APPROVE" | "REJECT"
  comment?: string | null
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: params.approvalRequestId },
  })
  if (!request) throw new Error("Approval request not found")

  const stage = await prisma.approvalRequestStage.findUnique({
    where: { id: params.requestStageId },
  })
  if (!stage) throw new Error("Request stage not found")

  const result = await recordDecision(params)

  // Post-transaction notifications
  if (result.stageComplete && result.stageResult === "APPROVED") {
    const updatedRequest = await prisma.approvalRequest.findUnique({
      where: { id: params.approvalRequestId },
    })
    if (updatedRequest?.status === "APPROVED") {
      createNotification({
        userId: request.requestedById,
        circleId: request.circleId,
        type: "APPROVAL_WORKFLOW_COMPLETED",
        title: `Approved: ${request.title}`,
        message: `Your request has been approved through all workflow stages.`,
        link: `/circles/${request.circleId}/approvals`,
      }).catch(console.error)
    } else {
      createNotification({
        userId: request.requestedById,
        circleId: request.circleId,
        type: "APPROVAL_STAGE_COMPLETED",
        title: `Stage completed: ${stage.name}`,
        message: `The "${stage.name}" stage has been completed. Next stage is now active.`,
        link: `/circles/${request.circleId}/approvals`,
      }).catch(console.error)
    }
  } else if (result.stageComplete && result.stageResult === "REJECTED") {
    createNotification({
      userId: request.requestedById,
      circleId: request.circleId,
      type: "SETTLEMENT_REJECTED",
      title: `Rejected: ${request.title}`,
      message: `Your request has been rejected at stage "${stage.name}".`,
      link: `/circles/${request.circleId}/approvals`,
    }).catch(console.error)
  }

  return result
}

// ─── 6. Cancel Remaining Stages ──────────────────────────

async function cancelRemainingStages(
  tx: any,
  requestId: string,
  completedStageId: string
) {
  const remaining = await tx.approvalRequestStage.findMany({
    where: {
      approvalRequestId: requestId,
      status: "WAITING",
    },
  })

  for (const s of remaining) {
    await tx.approvalRequestStage.update({
      where: { id: s.id },
      data: { status: "CANCELLED", completedAt: new Date() },
    })
  }
}

// ─── 7. Process Escalations ─────────────────────────────

export async function processEscalations(circleId?: string) {
  const now = new Date()

  const where: Record<string, unknown> = { status: "ACTIVE" }
  if (circleId) {
    where.approvalRequest = { circleId }
  }

  const activeStages = await prisma.approvalRequestStage.findMany({
    where: where as any,
    include: {
      approvalRequest: {
        select: { id: true, circleId: true, title: true, requestedById: true },
      },
      reviewers: true,
    },
  })

  const workflowStageIds = activeStages
    .map((s) => s.workflowStageId)
    .filter((id): id is string => !!id)
  const workflowStages = workflowStageIds.length
    ? await prisma.approvalWorkflowStage.findMany({
        where: { id: { in: workflowStageIds } },
        select: { id: true, escalationAfterHours: true },
      })
    : []
  const wfStageMap = new Map(workflowStages.map((ws) => [ws.id, ws]))

  let escalatedCount = 0

  for (const stage of activeStages) {
    if (!stage.activatedAt) continue
    const wfConfig = stage.workflowStageId
      ? wfStageMap.get(stage.workflowStageId)
      : null
    if (!wfConfig?.escalationAfterHours) continue

    const escalationDeadline = new Date(
      stage.activatedAt.getTime() +
        wfConfig.escalationAfterHours * 60 * 60 * 1000
    )

    if (now <= escalationDeadline) continue

    // Rate-limit: no more than one escalation per hour
    const recentEscalation = await prisma.approvalRequestDecision.findFirst({
      where: {
        approvalRequestId: stage.approvalRequest.id,
        source: "ESCALATION",
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    })
    if (recentEscalation) continue

    try {
      const ownerMembers = await prisma.circleMember.findMany({
        where: { circleId: stage.approvalRequest.circleId, role: "OWNER" },
        select: { userId: true },
      })

      for (const owner of ownerMembers) {
        createNotification({
          userId: owner.userId,
          circleId: stage.approvalRequest.circleId,
          type: "APPROVAL_ESCALATED",
          title: `Escalated: ${stage.approvalRequest.title}`,
          message: `Stage "${stage.name}" has been overdue and has been escalated to you.`,
          link: `/circles/${stage.approvalRequest.circleId}/approvals`,
        }).catch(console.error)
      }

      await createAuditLog({
        userId: null,
        circleId: stage.approvalRequest.circleId,
        action: "ESCALATED",
        entityType: "ApprovalRequestStage",
        entityId: stage.id,
        newValues: {
          stageName: stage.name,
          requestTitle: stage.approvalRequest.title,
          activatedAt: stage.activatedAt,
          escalationDeadline,
          escalatedOwners: ownerMembers.map((o) => o.userId),
        },
      })

      await emitEvent({
        type: "STAGE_ESCALATED",
        circleId: stage.approvalRequest.circleId,
        requestId: stage.approvalRequest.id,
        stageId: stage.id,
        timestamp: now,
        metadata: { escalationDeadline, owners: ownerMembers.map((o) => o.userId) },
      })

      escalatedCount++
    } catch (err) {
      console.error(`Failed to escalate stage ${stage.id}:`, err)
    }
  }

  return { escalatedCount }
}

// ─── 8. Process Expirations ─────────────────────────────

export async function processExpirations(circleId?: string) {
  const now = new Date()

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    expiresAt: { lt: now },
  }

  if (circleId) {
    where.approvalRequest = { circleId }
  }

  const expiredStages = await prisma.approvalRequestStage.findMany({
    where: where as any,
    include: {
      approvalRequest: {
        select: { id: true, circleId: true, title: true, requestedById: true },
      },
    },
  })

  let expiredCount = 0

  for (const stage of expiredStages) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.approvalRequestStage.update({
          where: { id: stage.id },
          data: { status: "EXPIRED", completedAt: now },
        })

        await cancelRemainingStages(tx, stage.approvalRequest.id, stage.id)

        await tx.approvalRequest.update({
          where: { id: stage.approvalRequest.id },
          data: {
            status: "EXPIRED",
            completedAt: now,
            currentStageId: null,
          },
        })

        await tx.auditLog.create({
          data: {
            userId: stage.approvalRequest.requestedById,
            circleId: stage.approvalRequest.circleId,
            action: "EXPIRED",
            entityType: "ApprovalRequestStage",
            entityId: stage.id,
            oldValues: { status: "ACTIVE" },
            newValues: { status: "EXPIRED", reason: "expired_by_system" },
          },
        })
      })

      createNotification({
        userId: stage.approvalRequest.requestedById,
        circleId: stage.approvalRequest.circleId,
        type: "APPROVAL_OVERDUE",
        title: `Expired: ${stage.approvalRequest.title}`,
        message: `Stage "${stage.name}" has expired.`,
        link: `/circles/${stage.approvalRequest.circleId}/approvals`,
      }).catch(console.error)

      await emitEvent({
        type: "STAGE_EXPIRED",
        circleId: stage.approvalRequest.circleId,
        requestId: stage.approvalRequest.id,
        stageId: stage.id,
        timestamp: now,
      })

      expiredCount++
    } catch (err) {
      console.error(`Failed to expire stage ${stage.id}:`, err)
    }
  }

  return { expiredCount }
}

// ─── 9. Get Request Stage Progress ──────────────────────

export async function getRequestStageProgress(approvalRequestId: string) {
  const stages = await prisma.approvalRequestStage.findMany({
    where: { approvalRequestId },
    include: {
      reviewers: true,
      decisions: {
        include: {
          reviewer: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
    orderBy: { order: "asc" },
  })

  const allMemberIds = [
    ...new Set(stages.flatMap((s) => s.reviewers.map((r) => r.memberId))),
  ]
  const members = allMemberIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allMemberIds } },
        select: { id: true, name: true, email: true, image: true },
      })
    : []
  const memberMap = new Map(members.map((m) => [m.id, m]))

  return stages.map((stage) => ({
    ...stage,
    reviewers: stage.reviewers.map((r) => ({
      ...r,
      member: memberMap.get(r.memberId) ?? null,
    })),
    totalReviewers: stage.reviewers.length,
    decidedCount: stage.decisions.length,
    approvedCount: stage.decisions.filter(
      (d) => d.decision === "APPROVE"
    ).length,
    rejectedCount: stage.decisions.filter(
      (d) => d.decision === "REJECT"
    ).length,
  }))
}

// ─── 10. Runtime Helpers ────────────────────────────────

export async function getCurrentStage(approvalRequestId: string) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
    select: { currentStageId: true },
  })
  if (!request?.currentStageId) return null

  const stage = await prisma.approvalRequestStage.findUnique({
    where: { id: request.currentStageId },
    include: { reviewers: true },
  })
  if (!stage) return null

  const memberIds = stage.reviewers.map((r) => r.memberId)
  const members = memberIds.length
    ? await prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, name: true, email: true, image: true },
      })
    : []
  const memberMap = new Map(members.map((m) => [m.id, m]))

  return {
    ...stage,
    reviewers: stage.reviewers.map((r) => ({
      ...r,
      member: memberMap.get(r.memberId) ?? null,
    })),
  }
}

export async function getNextStage(approvalRequestId: string, currentOrder: number) {
  return prisma.approvalRequestStage.findFirst({
    where: { approvalRequestId, order: { gt: currentOrder } },
    orderBy: { order: "asc" },
    include: { reviewers: true },
  })
}

export async function getPreviousStage(approvalRequestId: string, currentOrder: number) {
  return prisma.approvalRequestStage.findFirst({
    where: { approvalRequestId, order: { lt: currentOrder } },
    orderBy: { order: "desc" },
    include: {
      reviewers: true,
      decisions: true,
    },
  })
}

export async function getWorkflowProgress(approvalRequestId: string) {
  const stages = await prisma.approvalRequestStage.findMany({
    where: { approvalRequestId },
    include: {
      decisions: true,
      reviewers: true,
    },
    orderBy: { order: "asc" },
  })

  const totalStages = stages.length
  const completedStages = stages.filter(
    (s) => s.status === "APPROVED" || s.status === "REJECTED" || s.status === "CANCELLED" || s.status === "EXPIRED"
  ).length
  const currentStage = stages.find((s) => s.status === "ACTIVE")
  const overallStatus = totalStages === 0
    ? "NOT_STARTED"
    : stages.every((s) => s.status === "APPROVED")
      ? "COMPLETED"
      : stages.some((s) => s.status === "REJECTED" || s.status === "EXPIRED")
        ? "FAILED"
        : "IN_PROGRESS"

  return {
    totalStages,
    completedStages,
    currentStage: currentStage ?? null,
    overallStatus,
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      status: s.status,
      approvedCount: s.decisions.filter((d) => d.decision === "APPROVE").length,
      rejectedCount: s.decisions.filter((d) => d.decision === "REJECT").length,
      minimumApprovals: s.minimumApprovals,
      reviewerCount: s.reviewers.length,
    })),
  }
}

export async function getPendingReviewers(approvalRequestId: string) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
    select: { currentStageId: true },
  })
  if (!request?.currentStageId) return []

  const stage = await prisma.approvalRequestStage.findUnique({
    where: { id: request.currentStageId },
    include: { reviewers: true, decisions: true },
  })
  if (!stage) return []

  const decidedReviewerIds = new Set(stage.decisions.map((d) => d.reviewerId))
  return stage.reviewers.filter((r) => !decidedReviewerIds.has(r.memberId))
}

export async function getCompletedStages(approvalRequestId: string) {
  return prisma.approvalRequestStage.findMany({
    where: {
      approvalRequestId,
      status: { in: ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"] },
    },
    include: {
      decisions: {
        include: {
          reviewer: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      reviewers: true,
    },
    orderBy: { order: "asc" },
  })
}
