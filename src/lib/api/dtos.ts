import type {
  ApprovalWorkflow,
  ApprovalWorkflowStage,
  ApprovalWorkflowStageReviewer,
  ApprovalRequestStage,
  ApprovalRequestStageReviewer,
  ApprovalRequestDecision,
  ApprovalRequest,
  ApprovalDelegation,
  User,
  CircleMember,
} from "@/generated/prisma"

// ─── Primitive helpers ───────────────────────────────────

function toDate(v: Date | string | null | undefined): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString()
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  return Number(v)
}

// ─── User Summary ────────────────────────────────────────

export interface UserSummary {
  id: string
  name: string | null
  email: string
  image: string | null
}

export function toUserSummary(u: Pick<User, "id" | "name" | "email" | "image"> | null): UserSummary | null {
  if (!u) return null
  return { id: u.id, name: u.name, email: u.email, image: u.image }
}

// ─── Reviewer Rule (Workflow config reviewer) ────────────

export interface ReviewerRuleDto {
  id: string
  reviewerType: string
  role: string | null
  memberId: string | null
  permission: string | null
  required: boolean
}

export function toReviewerRule(r: ApprovalWorkflowStageReviewer): ReviewerRuleDto {
  return {
    id: r.id,
    reviewerType: r.reviewerType,
    role: r.role,
    memberId: r.memberId,
    permission: r.permission,
    required: r.required,
  }
}

// ─── Workflow Stage (config) ─────────────────────────────

export interface WorkflowStageDto {
  id: string
  name: string
  description: string | null
  order: number
  mode: string
  minimumApprovals: number
  rejectionThreshold: number | null
  requireAllReviewers: boolean
  allowSelfApproval: boolean
  ownerRequired: boolean
  expiresAfterHours: number | null
  escalationAfterHours: number | null
  reviewers: ReviewerRuleDto[]
}

export function toWorkflowStage(
  s: ApprovalWorkflowStage & { reviewers?: ApprovalWorkflowStageReviewer[] }
): WorkflowStageDto {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    order: s.order,
    mode: s.mode,
    minimumApprovals: s.minimumApprovals,
    rejectionThreshold: s.rejectionThreshold,
    requireAllReviewers: s.requireAllReviewers,
    allowSelfApproval: s.allowSelfApproval,
    ownerRequired: s.ownerRequired,
    expiresAfterHours: s.expiresAfterHours,
    escalationAfterHours: s.escalationAfterHours,
    reviewers: s.reviewers ? s.reviewers.map(toReviewerRule) : [],
  }
}

// ─── Workflow Summary (list item) ────────────────────────

export interface WorkflowSummaryDto {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  priority: number
  isDefault: boolean
  version: number
  currency: string | null
  minimumAmount: number | null
  maximumAmount: number | null
  stagesCount: number
  createdById: string
  createdBy: UserSummary | null
  createdAt: string
  updatedAt: string
}

export function toWorkflowSummary(
  w: ApprovalWorkflow & {
    stages?: unknown[]
    createdBy?: Pick<User, "id" | "name" | "email" | "image"> | null
    _count?: { stages: number }
  }
): WorkflowSummaryDto {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    type: w.type,
    status: w.status,
    priority: w.priority,
    isDefault: w.isDefault,
    version: w.version,
    currency: w.currency,
    minimumAmount: toNum(w.minimumAmount),
    maximumAmount: toNum(w.maximumAmount),
    stagesCount: w._count?.stages ?? w.stages?.length ?? 0,
    createdById: w.createdById,
    createdBy: toUserSummary(w.createdBy as any),
    createdAt: toDate(w.createdAt)!,
    updatedAt: toDate(w.updatedAt)!,
  }
}

// ─── Workflow Detail ─────────────────────────────────────

export interface WorkflowDetailDto extends WorkflowSummaryDto {
  stages: WorkflowStageDto[]
}

export function toWorkflowDetail(
  w: ApprovalWorkflow & {
    stages: (ApprovalWorkflowStage & { reviewers: ApprovalWorkflowStageReviewer[] })[]
    createdBy?: Pick<User, "id" | "name" | "email" | "image"> | null
  }
): WorkflowDetailDto {
  return {
    ...toWorkflowSummary(w),
    stages: w.stages.map(toWorkflowStage),
  }
}

// ─── Validation Result DTO ───────────────────────────────

export interface ValidationErrorDto {
  field: string
  code: string
  message: string
}

export interface ValidationResultDto {
  valid: boolean
  errors: ValidationErrorDto[]
  warnings: ValidationErrorDto[]
}

// ─── Runtime Stage ───────────────────────────────────────

export interface RuntimeStageReviewerDto {
  id: string
  memberId: string
  required: boolean
  delegatedFromMemberId: string | null
  member: UserSummary | null
}

export interface RuntimeStageDto {
  id: string
  approvalRequestId: string
  name: string
  order: number
  mode: string
  status: string
  minimumApprovals: number
  rejectionThreshold: number | null
  requireAllReviewers: boolean
  ownerRequired: boolean
  activatedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  totalReviewers: number
  decidedCount: number
  approvedCount: number
  rejectedCount: number
  reviewers: RuntimeStageReviewerDto[]
}

export function toRuntimeStage(
  s: ApprovalRequestStage & {
    reviewers: (ApprovalRequestStageReviewer & { member?: Pick<User, "id" | "name" | "email" | "image"> | null })[]
    decisions?: ApprovalRequestDecision[]
  }
): RuntimeStageDto {
  return {
    id: s.id,
    approvalRequestId: s.approvalRequestId,
    name: s.name,
    order: s.order,
    mode: s.mode,
    status: s.status,
    minimumApprovals: s.minimumApprovals,
    rejectionThreshold: s.rejectionThreshold,
    requireAllReviewers: s.requireAllReviewers,
    ownerRequired: s.ownerRequired,
    activatedAt: toDate(s.activatedAt),
    completedAt: toDate(s.completedAt),
    expiresAt: toDate(s.expiresAt),
    totalReviewers: s.reviewers.length,
    decidedCount: s.decisions?.length ?? 0,
    approvedCount: s.decisions?.filter((d) => d.decision === "APPROVE").length ?? 0,
    rejectedCount: s.decisions?.filter((d) => d.decision === "REJECT").length ?? 0,
    reviewers: s.reviewers.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      required: r.required,
      delegatedFromMemberId: r.delegatedFromMemberId,
      member: toUserSummary(r.member as any),
    })),
  }
}

// ─── Decision DTO ────────────────────────────────────────

export interface DecisionDto {
  id: string
  approvalRequestId: string
  requestStageId: string | null
  reviewerId: string
  originalReviewerId: string | null
  delegatedReviewerId: string | null
  decision: string
  comment: string | null
  source: string | null
  actedAt: string | null
  createdAt: string
  reviewer: UserSummary | null
}

export function toDecision(
  d: ApprovalRequestDecision & {
    reviewer?: Pick<User, "id" | "name" | "email" | "image"> | null
  }
): DecisionDto {
  return {
    id: d.id,
    approvalRequestId: d.approvalRequestId,
    requestStageId: d.requestStageId,
    reviewerId: d.reviewerId,
    originalReviewerId: d.originalReviewerId,
    delegatedReviewerId: d.delegatedReviewerId,
    decision: d.decision,
    comment: d.comment,
    source: d.source,
    actedAt: toDate(d.actedAt),
    createdAt: toDate(d.createdAt)!,
    reviewer: toUserSummary(d.reviewer as any),
  }
}

// ─── Approval Request Detail DTO ─────────────────────────

export interface ApprovalDetailDto {
  id: string
  circleId: string
  type: string
  status: string
  title: string
  description: string | null
  resourceId: string | null
  amount: number | null
  currency: string | null
  requestedById: string
  requestedBy: UserSummary | null
  minimumApprovals: number
  currentApprovals: number
  approvalsNeeded: number
  isExpired: boolean
  requestedAt: string
  approvedAt: string | null
  rejectedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  metadata: Record<string, unknown> | null
  workflowSnapshot: Record<string, unknown> | null
  currentStageId: string | null
  stages: RuntimeStageDto[]
  decisions: DecisionDto[]
  timeline: unknown[]
}

export function toApprovalDetail(
  a: ApprovalRequest & {
    requestedBy?: Pick<User, "id" | "name" | "email" | "image"> | null
    decisions?: (ApprovalRequestDecision & { reviewer?: Pick<User, "id" | "name" | "email" | "image"> | null })[]
  },
  stages: RuntimeStageDto[],
  timeline: unknown[]
): ApprovalDetailDto {
  const now = new Date()
  return {
    id: a.id,
    circleId: a.circleId,
    type: a.type,
    status: a.status,
    title: a.title,
    description: a.description,
    resourceId: a.resourceId,
    amount: toNum(a.amount),
    currency: a.currency,
    requestedById: a.requestedById,
    requestedBy: toUserSummary(a.requestedBy as any),
    minimumApprovals: a.minimumApprovals,
    currentApprovals: a.currentApprovals,
    approvalsNeeded: Math.max(0, a.minimumApprovals - a.currentApprovals),
    isExpired: a.expiresAt ? now > a.expiresAt : false,
    requestedAt: toDate(a.requestedAt)!,
    approvedAt: toDate(a.approvedAt),
    rejectedAt: toDate(a.rejectedAt),
    completedAt: toDate(a.completedAt),
    expiresAt: toDate(a.expiresAt),
    metadata: (a.metadata as Record<string, unknown>) ?? null,
    workflowSnapshot: (a.workflowSnapshot as Record<string, unknown>) ?? null,
    currentStageId: a.currentStageId,
    stages,
    decisions: a.decisions ? a.decisions.map(toDecision) : [],
    timeline,
  }
}

// ─── Delegation DTO ──────────────────────────────────────

export interface DelegationDto {
  id: string
  circleId: string
  delegatorMemberId: string
  delegateMemberId: string
  approvalType: string | null
  workflowId: string | null
  stageId: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  reason: string | null
  createdAt: string
  delegator?: UserSummary | null
  delegate?: UserSummary | null
}

export function toDelegation(
  d: ApprovalDelegation & {
    delegator?: Pick<User, "id" | "name" | "email" | "image"> | null
    delegate?: Pick<User, "id" | "name" | "email" | "image"> | null
  }
): DelegationDto {
  return {
    id: d.id,
    circleId: d.circleId,
    delegatorMemberId: d.delegatorMemberId,
    delegateMemberId: d.delegateMemberId,
    approvalType: d.approvalType,
    workflowId: d.workflowId,
    stageId: d.stageId,
    status: d.status,
    startsAt: toDate(d.startsAt),
    endsAt: toDate(d.endsAt),
    reason: d.reason,
    createdAt: toDate(d.createdAt)!,
    delegator: toUserSummary(d.delegator as any),
    delegate: toUserSummary(d.delegate as any),
  }
}

// ─── Approval Stats DTO ──────────────────────────────────

export interface ApprovalStatsDto {
  pending: number
  assignedToMe: number
  delegatedToMe: number
  overdue: number
  escalated: number
  approvedToday: number
  rejectedToday: number
  pendingByWorkflow: Array<{ workflowId: string; workflowName: string; count: number }>
}

// ─── Workflow Preview DTO ────────────────────────────────

export interface WorkflowPreviewDto {
  workflowSelected: boolean
  workflowId: string | null
  workflowName: string | null
  workflowVersion: number | null
  fallbackPath: boolean
  stages: WorkflowStageDto[]
  resolvedReviewers: Array<{
    stageName: string
    stageOrder: number
    memberId: string
    memberName: string | null
    isDelegated: boolean
    delegatedFrom: string | null
  }>
  excludedReviewers: Array<{
    memberId: string
    reason: string
  }>
  selfApprovalConflicts: Array<{
    stageName: string
    memberId: string
  }>
  missingReviewerWarnings: Array<{
    stageName: string
    message: string
  }>
  estimatedExpiry: string | null
  finalisationPossible: boolean
}
