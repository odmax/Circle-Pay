import { prisma } from "@/lib/prisma"
import type {
  ApprovalStatus,
  ApprovalStageRuntimeStatus,
  ApprovalDecision,
} from "@/generated/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification, notifyCircleMembers } from "@/lib/services/notification.service"
import { resolveWorkflow } from "./approval-workflow.service"

// ─── 1. Initialise Approval with Workflow ────────────────

export async function initialiseApprovalWorkflow(params: {
  circleId: string
  requestId: string
  type: string
  amount?: number | null
  currency?: string | null
  createdById: string
}) {
  const { circleId, requestId, type, amount, currency, createdById } = params

  const workflow = await resolveWorkflow({ circleId, type: type as any, amount, currency })
  if (!workflow) return null // No workflow configured — use simple approval

  // Create runtime stages from workflow stages
  const runtimeStages = await prisma.$transaction(async (tx) => {
    const stages = []

    for (const wfStage of workflow.stages) {
      // Resolve actual reviewers
      const resolvedReviewers = await resolveReviewers(tx, circleId, wfStage)

      if (resolvedReviewers.length === 0) continue // Skip stages with no eligible reviewers

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

    // Update request with workflow snapshot and current stage
    await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        workflowSnapshot: {
          workflowId: workflow.id,
          workflowName: workflow.name,
          workflowVersion: workflow.version,
          stagesCount: stages.length,
        },
        currentStageId: stages.length > 0 ? stages[0].id : null,
      },
    })

    // Activate first stage
    if (stages.length > 0) {
      await tx.approvalRequestStage.update({
        where: { id: stages[0].id },
        data: { status: "ACTIVE", activatedAt: new Date() },
      })

      // Notify assigned reviewers
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

  return { workflow, runtimeStages }
}

// ─── 2. Resolve Eligible Reviewers for a Stage ──────────

async function resolveReviewers(
  tx: any,
  circleId: string,
  wfStage: any
): Promise<Array<{ memberId: string; required: boolean; delegatedFromMemberId?: string | null }>> {
  const reviewers: Array<{ memberId: string; required: boolean; delegatedFromMemberId?: string | null }> = []
  const seen = new Set<string>()

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
      // Find members with this permission via role defaults or overrides
      const members = await tx.circleMember.findMany({
        where: { circleId },
        select: { userId: true, role: true, permissions: { select: { permission: true, granted: true } } },
      })
      // This is simplified — in production, resolve via getCircleMemberPermissions
      candidateIds = members
        .filter((m: any) => m.permissions.some((p: any) => p.permission === wfReviewer.permission && p.granted))
        .map((m: any) => m.userId)
    }

    for (const memberId of candidateIds) {
      if (seen.has(memberId)) continue
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

      if (delegation) {
        // The delegate acts in place of the delegator
        reviewers.push({
          memberId,
          required: wfReviewer.required,
          delegatedFromMemberId: delegation.delegatorMemberId,
        })
      } else {
        reviewers.push({
          memberId,
          required: wfReviewer.required,
        })
      }
    }
  }

  return reviewers
}

// ─── 3. Process Stage Decision ──────────────────────────

export async function processStageDecision(params: {
  approvalRequestId: string
  requestStageId: string
  reviewerId: string
  decision: "APPROVE" | "REJECT"
  comment?: string | null
}) {
  const { approvalRequestId, requestStageId, reviewerId, decision, comment } = params

  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
  })
  if (!request) throw new Error("Approval request not found")
  if (request.status !== "PENDING") throw new Error("Approval request is not pending")

  const stage = await prisma.approvalRequestStage.findUnique({
    where: { id: requestStageId },
    include: { reviewers: true },
  })
  if (!stage) throw new Error("Request stage not found")
  if (stage.status !== "ACTIVE") throw new Error("Stage is not active")
  if (stage.approvalRequestId !== approvalRequestId) throw new Error("Stage does not belong to this request")

  // Verify reviewer is assigned to this stage
  const assignedReviewer = stage.reviewers.find((r) => r.memberId === reviewerId)
  if (!assignedReviewer) throw new Error("You are not assigned as a reviewer for this stage")

  // Check if already acted
  const existingDecision = await prisma.approvalRequestDecision.findFirst({
    where: { approvalRequestId, requestStageId, reviewerId },
  })
  if (existingDecision) throw new Error("You have already voted on this stage")

  // Check self-approval (allowSelfApproval lives on ApprovalWorkflowStage, not the runtime stage)
  let allowSelfApproval = false
  if (stage.workflowStageId) {
    const wfStage = await prisma.approvalWorkflowStage.findUnique({
      where: { id: stage.workflowStageId },
      select: { allowSelfApproval: true },
    })
    allowSelfApproval = wfStage?.allowSelfApproval ?? false
  }

  if (!allowSelfApproval && request.requestedById === reviewerId) {
    throw new Error("Self-approval is not allowed for this stage")
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create decision
    const newDecision = await tx.approvalRequestDecision.create({
      data: {
        approvalRequestId,
        requestStageId,
        reviewerId,
        originalReviewerId: assignedReviewer.delegatedFromMemberId || reviewerId,
        delegatedReviewerId: assignedReviewer.delegatedFromMemberId ? reviewerId : null,
        decision: decision as ApprovalDecision,
        comment: comment || null,
        source: assignedReviewer.delegatedFromMemberId ? "DELEGATION" : "DIRECT",
        actedAt: new Date(),
      },
    })

    // Count decisions for this stage
    const stageDecisions = await tx.approvalRequestDecision.findMany({
      where: { requestStageId, decision: decision as ApprovalDecision },
    })

    const stageReviewerCount = stage.reviewers.length
    const totalDecisionsForStage = await tx.approvalRequestDecision.count({
      where: { requestStageId },
    })

    let stageComplete = false
    let stageResult: "APPROVED" | "REJECTED" | null = null

    if (decision === "REJECT") {
      // Check rejection threshold
      const rejections = await tx.approvalRequestDecision.count({
        where: { requestStageId, decision: "REJECT" },
      })
      if (stage.rejectionThreshold && rejections >= stage.rejectionThreshold) {
        stageComplete = true
        stageResult = "REJECTED"
      } else if (stage.requireAllReviewers && totalDecisionsForStage === stageReviewerCount) {
        stageComplete = true
        stageResult = "REJECTED"
      } else if (!stage.rejectionThreshold && !stage.requireAllReviewers && rejections > 0) {
        // Single rejection kills the stage
        stageComplete = true
        stageResult = "REJECTED"
      }
    } else {
      // APPROVE
      const approvals = stageDecisions.length
      if (stage.mode === "PARALLEL" && stage.requireAllReviewers) {
        if (approvals >= stageReviewerCount) {
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

    if (stageComplete && stageResult) {
      await tx.approvalRequestStage.update({
        where: { id: requestStageId },
        data: {
          status: stageResult as ApprovalStageRuntimeStatus,
          completedAt: new Date(),
        },
      })

      if (stageResult === "REJECTED") {
        // Reject entire request
        await tx.approvalRequest.update({
          where: { id: approvalRequestId },
          data: {
            status: "REJECTED" as ApprovalStatus,
            rejectedAt: new Date(),
            completedAt: new Date(),
            currentStageId: null,
          },
        })
      } else {
        // Stage approved — activate next stage or complete request
        const nextStage = await tx.approvalRequestStage.findFirst({
          where: { approvalRequestId, status: "WAITING" },
          orderBy: { order: "asc" },
        })

        if (nextStage) {
          await tx.approvalRequestStage.update({
            where: { id: nextStage.id },
            data: { status: "ACTIVE", activatedAt: new Date() },
          })
          await tx.approvalRequest.update({
            where: { id: approvalRequestId },
            data: { currentStageId: nextStage.id },
          })
        } else {
          // All stages complete — approve request
          await tx.approvalRequest.update({
            where: { id: approvalRequestId },
            data: {
              status: "APPROVED" as ApprovalStatus,
              approvedAt: new Date(),
              completedAt: new Date(),
              currentStageId: null,
              currentApprovals: request.currentApprovals + 1,
            },
          })
        }
      }
    } else {
      // Stage not complete yet — just update count
      await tx.approvalRequest.update({
        where: { id: approvalRequestId },
        data: { currentApprovals: request.currentApprovals + 1 },
      })
    }

    return { decision: newDecision, stageComplete, stageResult }
  })

  // Post-transaction notifications
  if (result.stageComplete && result.stageResult === "APPROVED") {
    // Check if request is now fully approved
    const updatedRequest = await prisma.approvalRequest.findUnique({ where: { id: approvalRequestId } })
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
      // Notify about next stage activation
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

// ─── 4. Process Escalations ─────────────────────────────

export async function processEscalations(circleId?: string) {
  const now = new Date()

  // Find stages with escalation configured that are active and past their escalation time
  const where: Record<string, unknown> = {
    status: "ACTIVE",
  }

  if (circleId) {
    where.approvalRequest = { circleId }
  }

  const activeStages = await prisma.approvalRequestStage.findMany({
    where: where as any,
    include: {
      approvalRequest: { select: { id: true, circleId: true, title: true, requestedById: true } },
      reviewers: true,
    },
  })

  // Fetch workflow stage escalation config for stages that need it
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
    const wfConfig = stage.workflowStageId ? wfStageMap.get(stage.workflowStageId) : null
    if (!wfConfig?.escalationAfterHours) continue

    const escalationDeadline = new Date(stage.activatedAt.getTime() + wfConfig.escalationAfterHours * 60 * 60 * 1000)

    if (now <= escalationDeadline) continue

    // Check if already escalated (within last hour to prevent spam)
    const recentEscalation = await prisma.approvalRequestDecision.findFirst({
      where: {
        approvalRequestId: stage.approvalRequest.id,
        source: "ESCALATION",
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    })

    if (recentEscalation) continue

    try {
      // Auto-escalate: notify owner
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

      escalatedCount++
    } catch (err) {
      console.error(`Failed to escalate stage ${stage.id}:`, err)
    }
  }

  return { escalatedCount }
}

// ─── 5. Process Expirations ─────────────────────────────

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
      approvalRequest: { select: { id: true, circleId: true, title: true, requestedById: true } },
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

      expiredCount++
    } catch (err) {
      console.error(`Failed to expire stage ${stage.id}:`, err)
    }
  }

  return { expiredCount }
}

// ─── 6. Get Request Stage Progress ──────────────────────

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

  // Batch-fetch member info for all stage reviewers
  const allMemberIds = [...new Set(stages.flatMap((s) => s.reviewers.map((r) => r.memberId)))]
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
    approvedCount: stage.decisions.filter((d) => d.decision === "APPROVE").length,
    rejectedCount: stage.decisions.filter((d) => d.decision === "REJECT").length,
  }))
}
