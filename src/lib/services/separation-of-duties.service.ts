import { prisma } from "@/lib/prisma"

// ─── Separation of Duties Validation ────────────────────
// Ensures the same person who created a request cannot approve it,
// and validates that stage reviewers are distinct from requesters.

export interface SoDValidationResult {
  valid: boolean
  violation?: string
  details?: Record<string, unknown>
}

export async function validateSeparationOfDuties(params: {
  circleId: string
  requestId: string
  reviewerId: string
  stageId?: string | null
}): Promise<SoDValidationResult> {
  const { circleId, requestId, reviewerId, stageId } = params

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    select: { requestedById: true, circleId: true, title: true },
  })
  if (!request) return { valid: false, violation: "Request not found" }

  // Rule 1: Requester cannot approve their own request
  if (request.requestedById === reviewerId) {
    return {
      valid: false,
      violation: "REVIEWER_IS_REQUESTER",
      details: {
        message: "The person who created a request cannot approve their own request.",
        requestId,
        reviewerId,
      },
    }
  }

  // Rule 2: Check if reviewer was involved in creating/modifying the resource
  // (simplified — in production, check resource history)
  if (stageId) {
    const stage = await prisma.approvalRequestStage.findUnique({
      where: { id: stageId },
      select: { approvalRequestId: true, ownerRequired: true, workflowStageId: true },
    })

    if (stage?.workflowStageId) {
      const wfStage = await prisma.approvalWorkflowStage.findUnique({
        where: { id: stage.workflowStageId },
        select: { allowSelfApproval: true },
      })
      if (wfStage?.allowSelfApproval) {
        return { valid: true }
      }
    }
  }

  // Rule 3: Check for prior decisions on the same request
  const priorDecision = await prisma.approvalRequestDecision.findFirst({
    where: {
      approvalRequestId: requestId,
      reviewerId,
      decision: "APPROVE",
    },
  })

  // This is informational — not a hard block, but flagged
  if (priorDecision) {
    return {
      valid: true,
      violation: "DUPLICATE_REVIEWER_INFO",
      details: {
        message: "This reviewer has already approved a previous stage.",
        priorDecisionId: priorDecision.id,
      },
    }
  }

  return { valid: true }
}

// ─── Check Conflict of Interest ─────────────────────────

export async function checkConflictOfInterest(params: {
  circleId: string
  reviewerId: string
  requestedById: string
  resourceType?: string | null
  resourceId?: string | null
}): Promise<SoDValidationResult> {
  const { circleId, reviewerId, requestedById } = params

  // Check if reviewer and requester are in the same household/team
  // (simplified — in production, check relationships, groups, etc.)

  // Check if reviewer has recently delegated to/from requester
  const mutualDelegation = await prisma.approvalDelegation.findFirst({
    where: {
      circleId,
      OR: [
        { delegatorMemberId: reviewerId, delegateMemberId: requestedById },
        { delegatorMemberId: requestedById, delegateMemberId: reviewerId },
      ],
      status: "ACTIVE",
    },
  })

  if (mutualDelegation) {
    return {
      valid: true, // Warning, not block
      violation: "POTENTIAL_CONFLICT_INFO",
      details: {
        message: "Reviewer and requester have an active delegation relationship.",
        delegationId: mutualDelegation.id,
      },
    }
  }

  return { valid: true }
}

// ─── Validate Workflow Configuration SoD ────────────────

export async function validateWorkflowSoD(params: {
  circleId: string
  stages: Array<{
    name: string
    order: number
    reviewers: Array<{ memberId?: string | null; role?: string | null }>
    minimumApprovals: number
  }>
}): Promise<SoDValidationResult> {
  const { stages } = params

  // Rule 1: Consecutive stages should have different reviewers
  for (let i = 0; i < stages.length - 1; i++) {
    const currentReviewers = new Set(stages[i].reviewers.map((r) => r.memberId).filter(Boolean))
    const nextReviewers = new Set(stages[i + 1].reviewers.map((r) => r.memberId).filter(Boolean))

    const overlap = [...currentReviewers].filter((id) => nextReviewers.has(id))
    if (overlap.length > 0 && currentReviewers.size === overlap.length) {
      return {
        valid: false,
        violation: "SAME_REVIEWERS_CONSECUTIVE_STAGES",
        details: {
          message: `Stages "${stages[i].name}" and "${stages[i + 1].name}" have the same reviewers.`,
          overlappingMembers: overlap,
        },
      }
    }
  }

  // Rule 2: Minimum approvals should not exceed available reviewers
  for (const stage of stages) {
    if (stage.reviewers.length === 0) {
      return {
        valid: false,
        violation: "NO_REVIEWERS_IN_STAGE",
        details: {
          message: `Stage "${stage.name}" has no reviewers.`,
        },
      }
    }

    if (stage.minimumApprovals > stage.reviewers.length) {
      return {
        valid: false,
        violation: "MIN_APPROVALS_EXCEEDS_REVIEWERS",
        details: {
          message: `Stage "${stage.name}" requires ${stage.minimumApprovals} approvals but only has ${stage.reviewers.length} reviewers.`,
        },
      }
    }
  }

  return { valid: true }
}
