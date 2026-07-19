import { z } from "zod"

const ApprovalTypeEnum = z.enum([
  "CONTRIBUTION",
  "EXPENSE",
  "SETTLEMENT",
  "PROJECT",
  "WALLET_WITHDRAWAL",
  "WALLET_TRANSFER",
  "GOAL_WITHDRAWAL",
  "JOIN_REQUEST",
  "MEMBER_PROMOTION",
  "OTHER",
])

const StageModeEnum = z.enum(["SEQUENTIAL", "PARALLEL"])

const ReviewerTypeEnum = z.enum(["ROLE", "MEMBER", "PERMISSION"])

const CurrencyRegex = /^[A-Z]{3}$/

// ─── Reviewer Rule ───────────────────────────────────────

export const workflowReviewerRuleSchema = z.object({
  reviewerType: ReviewerTypeEnum,
  role: z.string().max(50).nullable().optional(),
  memberId: z.string().uuid().nullable().optional(),
  permission: z.string().max(100).nullable().optional(),
  required: z.boolean().optional(),
})

// ─── Stage Input ─────────────────────────────────────────

export const workflowStageInputSchema = z
  .object({
    name: z.string().min(1, "Stage name is required").max(100),
    description: z.string().max(500).nullable().optional(),
    order: z.number().int().min(1, "Order must start from 1"),
    mode: StageModeEnum,
    minimumApprovals: z.number().int().min(1, "Minimum 1 approval required"),
    rejectionThreshold: z.number().int().min(1).nullable().optional(),
    requireAllReviewers: z.boolean().optional(),
    allowSelfApproval: z.boolean().optional(),
    ownerRequired: z.boolean().optional(),
    expiresAfterHours: z.number().min(0.1).max(8760).nullable().optional(),
    escalationAfterHours: z.number().min(0.1).max(8760).nullable().optional(),
    reviewers: z
      .array(workflowReviewerRuleSchema)
      .min(1, "At least one reviewer is required"),
  })
  .refine(
    (data) => {
      if (data.rejectionThreshold && data.rejectionThreshold > data.reviewers.length) {
        return false
      }
      return true
    },
    { message: "Rejection threshold cannot exceed reviewer count", path: ["rejectionThreshold"] }
  )

// ─── Create Workflow ─────────────────────────────────────

export const createWorkflowSchema = z
  .object({
    name: z.string().min(1, "Workflow name is required").max(100),
    description: z.string().max(500).nullable().optional(),
    type: ApprovalTypeEnum,
    priority: z.number().int().min(0).max(1000).optional(),
    minimumAmount: z.number().min(0).nullable().optional(),
    maximumAmount: z.number().min(0).nullable().optional(),
    currency: z
      .string()
      .regex(CurrencyRegex, "Currency must be a 3-letter ISO code")
      .nullable()
      .optional(),
    isDefault: z.boolean().optional(),
    stages: z.array(workflowStageInputSchema).min(1, "At least one stage is required"),
  })
  .refine(
    (data) => {
      if (data.minimumAmount != null && data.maximumAmount != null) {
        return data.minimumAmount <= data.maximumAmount
      }
      return true
    },
    { message: "minimumAmount must be less than or equal to maximumAmount", path: ["maximumAmount"] }
  )

// ─── Update Workflow ─────────────────────────────────────

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  minimumAmount: z.number().min(0).nullable().optional(),
  maximumAmount: z.number().min(0).nullable().optional(),
  currency: z.string().regex(CurrencyRegex).nullable().optional(),
  isDefault: z.boolean().nullable().optional(),
  stages: z.array(workflowStageInputSchema).min(1).optional(),
})

// ─── Duplicate Workflow ──────────────────────────────────

export const duplicateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  minimumAmount: z.number().min(0).nullable().optional(),
  maximumAmount: z.number().min(0).nullable().optional(),
  currency: z.string().regex(CurrencyRegex).nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isDefault: z.boolean().optional(),
})

// ─── Approval Decision ───────────────────────────────────

export const approvalDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(1000).nullable().optional(),
  stageId: z.string().uuid().nullable().optional(),
})

// ─── Cancel Approval ─────────────────────────────────────

export const cancelApprovalSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
})

// ─── Manual Escalation ───────────────────────────────────

export const manualEscalationSchema = z.object({
  action: z.enum(["NOTIFY", "REASSIGN", "SKIP_STAGE"]),
  reason: z.string().min(1, "Reason is required").max(500),
  targetMemberId: z.string().uuid().nullable().optional(),
})

// ─── Reviewer Reassignment ───────────────────────────────

export const reviewerReassignmentSchema = z.object({
  requestStageReviewerId: z.string().uuid("Invalid reviewer ID"),
  replacementMemberId: z.string().uuid("Invalid member ID"),
  reason: z.string().min(1, "Reason is required").max(500),
})

// ─── Delegation Creation ─────────────────────────────────

export const createDelegationSchema = z
  .object({
    delegateMemberId: z.string().uuid("Invalid delegate member ID"),
    approvalType: ApprovalTypeEnum.nullable().optional(),
    workflowId: z.string().uuid().nullable().optional(),
    stageId: z.string().uuid().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime("Invalid end date"),
    reason: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt)
      }
      return true
    },
    { message: "End date must be after start date", path: ["endsAt"] }
  )

// ─── Workflow Preview ────────────────────────────────────

export const workflowPreviewSchema = z.object({
  approvalType: ApprovalTypeEnum,
  amount: z.number().min(0).nullable().optional(),
  currency: z.string().regex(CurrencyRegex).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

// ─── Workflow Query Params ───────────────────────────────

export const workflowListQuerySchema = z.object({
  type: ApprovalTypeEnum.optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  currency: z.string().regex(CurrencyRegex).optional(),
  isDefault: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  search: z.string().max(100).optional(),
  page: z
    .string()
    .transform((v) => Math.max(1, parseInt(v) || 1))
    .optional(),
  pageSize: z
    .string()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v) || 20)))
    .optional(),
  sortBy: z.enum(["name", "priority", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

// ─── Approval Queue Query ────────────────────────────────

export const approvalQueueQuerySchema = z.object({
  scope: z.enum(["mine", "delegated", "all", "requestedByMe", "overdue", "escalated", "completed"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"]).optional(),
  type: ApprovalTypeEnum.optional(),
  workflowId: z.string().uuid().optional(),
  stageStatus: z.enum(["ACTIVE", "WAITING", "APPROVED", "REJECTED", "EXPIRED"]).optional(),
  requester: z.string().uuid().optional(),
  amountMin: z.coerce.number().min(0).optional(),
  amountMax: z.coerce.number().min(0).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>
export type DuplicateWorkflowInput = z.infer<typeof duplicateWorkflowSchema>
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>
export type CancelApprovalInput = z.infer<typeof cancelApprovalSchema>
export type ManualEscalationInput = z.infer<typeof manualEscalationSchema>
export type ReviewerReassignmentInput = z.infer<typeof reviewerReassignmentSchema>
export type CreateDelegationInput = z.infer<typeof createDelegationSchema>
export type WorkflowPreviewInput = z.infer<typeof workflowPreviewSchema>
