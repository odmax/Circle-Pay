import { prisma } from "@/lib/prisma"
import type {
  ApprovalWorkflowStatus,
  ApprovalType,
  ApprovalStageMode,
  ApprovalReviewerType,
} from "@/generated/prisma"
import { requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { validateWorkflowSoD } from "@/lib/services/separation-of-duties.service"

// ─── Types ────────────────────────────────────────────────

export interface WorkflowStageInput {
  name: string
  description?: string | null
  order: number
  mode: "SEQUENTIAL" | "PARALLEL"
  minimumApprovals: number
  rejectionThreshold?: number | null
  requireAllReviewers?: boolean
  allowSelfApproval?: boolean
  ownerRequired?: boolean
  expiresAfterHours?: number | null
  escalationAfterHours?: number | null
  reviewers: WorkflowReviewerInput[]
}

export interface WorkflowReviewerInput {
  reviewerType: "ROLE" | "MEMBER" | "PERMISSION"
  role?: string | null
  memberId?: string | null
  permission?: string | null
  required?: boolean
}

export interface WorkflowCreateInput {
  circleId: string
  name: string
  description?: string | null
  type: ApprovalType
  priority?: number
  minimumAmount?: number | null
  maximumAmount?: number | null
  currency?: string | null
  isDefault?: boolean
  createdById: string
  stages: WorkflowStageInput[]
}

export interface WorkflowValidationError {
  field: string
  code: string
  message: string
}

export interface WorkflowValidationResult {
  valid: boolean
  errors: WorkflowValidationError[]
  warnings: WorkflowValidationError[]
}

// ─── 1. Validate Workflow ─────────────────────────────────
// Comprehensive validation of workflow configuration before
// create/activate. Runs structural validation + SoD checks.

export async function validateWorkflow(params: {
  circleId: string
  stages: WorkflowStageInput[]
  isDefault?: boolean
  type?: ApprovalType
  workflowId?: string
}): Promise<WorkflowValidationResult> {
  const errors: WorkflowValidationError[] = []
  const warnings: WorkflowValidationError[] = []
  const { circleId, stages, isDefault, type, workflowId } = params

  if (stages.length === 0) {
    errors.push({ field: "stages", code: "NO_STAGES", message: "Workflow must have at least one stage" })
    return { valid: false, errors, warnings }
  }

  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  const seenOrders = new Set<number>()
  const seenNames = new Set<string>()

  for (let i = 0; i < sortedStages.length; i++) {
    const stage = sortedStages[i]

    if (stage.order !== i + 1) {
      errors.push({
        field: `stages[${i}].order`,
        code: "ORDER_GAP",
        message: `Stage order must be sequential from 1 without gaps. Expected ${i + 1}, got ${stage.order}`,
      })
    }

    if (seenOrders.has(stage.order)) {
      errors.push({
        field: `stages[${i}].order`,
        code: "DUPLICATE_ORDER",
        message: `Duplicate stage order: ${stage.order}`,
      })
    }
    seenOrders.add(stage.order)

    const normalisedName = stage.name.trim().toLowerCase()
    if (seenNames.has(normalisedName)) {
      errors.push({
        field: `stages[${i}].name`,
        code: "DUPLICATE_NAME",
        message: `Duplicate stage name: "${stage.name}"`,
      })
    }
    seenNames.add(normalisedName)

    if (!stage.name.trim()) {
      errors.push({ field: `stages[${i}].name`, code: "EMPTY_NAME", message: "Stage name cannot be empty" })
    }

    if (stage.reviewers.length === 0) {
      errors.push({
        field: `stages[${i}].reviewers`,
        code: "NO_REVIEWERS",
        message: `Stage "${stage.name}" must have at least one reviewer`,
      })
    }

    if (stage.minimumApprovals < 1) {
      errors.push({
        field: `stages[${i}].minimumApprovals`,
        code: "INVALID_THRESHOLD",
        message: `Stage "${stage.name}" must require at least 1 approval`,
      })
    }

    if (stage.minimumApprovals > stage.reviewers.length && stage.reviewers.length > 0) {
      warnings.push({
        field: `stages[${i}].minimumApprovals`,
        code: "THRESHOLD_EXCEEDS_REVIEWERS",
        message: `Stage "${stage.name}" requires ${stage.minimumApprovals} approvals but only has ${stage.reviewers.length} reviewer(s)`,
      })
    }

    if (stage.mode === "PARALLEL" && stage.rejectionThreshold) {
      if (stage.rejectionThreshold > stage.reviewers.length) {
        warnings.push({
          field: `stages[${i}].rejectionThreshold`,
          code: "REJECTION_EXCEEDS_REVIEWERS",
          message: `Stage "${stage.name}" rejection threshold (${stage.rejectionThreshold}) exceeds reviewer count (${stage.reviewers.length})`,
        })
      }
    }

    if (stage.expiresAfterHours != null && stage.expiresAfterHours <= 0) {
      errors.push({
        field: `stages[${i}].expiresAfterHours`,
        code: "INVALID_EXPIRY",
        message: `Stage "${stage.name}" expiry must be positive`,
      })
    }

    if (stage.escalationAfterHours != null && stage.escalationAfterHours <= 0) {
      errors.push({
        field: `stages[${i}].escalationAfterHours`,
        code: "INVALID_ESCALATION",
        message: `Stage "${stage.name}" escalation time must be positive`,
      })
    }

    if (stage.expiresAfterHours && stage.escalationAfterHours) {
      if (stage.escalationAfterHours >= stage.expiresAfterHours) {
        warnings.push({
          field: `stages[${i}].escalationAfterHours`,
          code: "ESCALATION_AFTER_EXPIRY",
          message: `Stage "${stage.name}" escalation (${stage.escalationAfterHours}h) occurs after expiry (${stage.expiresAfterHours}h) — escalation will never trigger`,
        })
      }
    }

    for (let j = 0; j < stage.reviewers.length; j++) {
      const reviewer = stage.reviewers[j]
      if (reviewer.reviewerType === "ROLE" && !reviewer.role) {
        errors.push({
          field: `stages[${i}].reviewers[${j}].role`,
          code: "MISSING_ROLE",
          message: `Reviewer with type ROLE must specify a role`,
        })
      }
      if (reviewer.reviewerType === "MEMBER" && !reviewer.memberId) {
        errors.push({
          field: `stages[${i}].reviewers[${j}].memberId`,
          code: "MISSING_MEMBER",
          message: `Reviewer with type MEMBER must specify a memberId`,
        })
      }
      if (reviewer.reviewerType === "PERMISSION" && !reviewer.permission) {
        errors.push({
          field: `stages[${i}].reviewers[${j}].permission`,
          code: "MISSING_PERMISSION",
          message: `Reviewer with type PERMISSION must specify a permission`,
        })
      }
    }
  }

  // Validate consecutive reviewer overlap
  for (let i = 0; i < sortedStages.length - 1; i++) {
    const currentMemberIds = new Set(
      sortedStages[i].reviewers.map((r) => r.memberId).filter(Boolean)
    )
    const nextMemberIds = new Set(
      sortedStages[i + 1].reviewers.map((r) => r.memberId).filter(Boolean)
    )
    const overlap = [...currentMemberIds].filter((id) => nextMemberIds.has(id))
    if (overlap.length > 0 && currentMemberIds.size === overlap.length && currentMemberIds.size === nextMemberIds.size) {
      warnings.push({
        field: `stages[${i}].reviewers`,
        code: "SAME_REVIEWERS_CONSECUTIVE",
        message: `Stages "${sortedStages[i].name}" and "${sortedStages[i + 1].name}" have identical reviewer sets`,
      })
    }
  }

  // Only one default per circle+type
  if (isDefault && type) {
    const existingDefault = await prisma.approvalWorkflow.findFirst({
      where: {
        circleId,
        type,
        isDefault: true,
        status: { not: "ARCHIVED" },
        ...(workflowId ? { NOT: { id: workflowId } } : {}),
      },
    })
    if (existingDefault) {
      warnings.push({
        field: "isDefault",
        code: "REPLACES_EXISTING_DEFAULT",
        message: `This will replace "${existingDefault.name}" as the default workflow for ${type}`,
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── 2. Create Workflow ───────────────────────────────────

export async function createWorkflow(data: WorkflowCreateInput) {
  await requireCirclePermission({
    userId: data.createdById,
    circleId: data.circleId,
    permission: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_CREATE,
  })

  const validation = await validateWorkflow({
    circleId: data.circleId,
    stages: data.stages,
    isDefault: data.isDefault,
    type: data.type,
  })
  if (!validation.valid) {
    throw new Error(
      `Workflow validation failed: ${validation.errors.map((e) => e.message).join("; ")}`
    )
  }

  // If marking as default, unset other defaults
  if (data.isDefault) {
    await prisma.approvalWorkflow.updateMany({
      where: { circleId: data.circleId, type: data.type, isDefault: true },
      data: { isDefault: false },
    })
  }

  const sortedStages = [...data.stages].sort((a, b) => a.order - b.order)

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      circleId: data.circleId,
      name: data.name,
      description: data.description || null,
      type: data.type,
      priority: data.priority ?? 0,
      minimumAmount: data.minimumAmount ?? null,
      maximumAmount: data.maximumAmount ?? null,
      currency: data.currency || null,
      isDefault: data.isDefault ?? false,
      createdById: data.createdById,
      stages: {
        create: sortedStages.map((stage) => ({
          name: stage.name,
          description: stage.description || null,
          order: stage.order,
          mode: stage.mode,
          minimumApprovals: stage.minimumApprovals,
          rejectionThreshold: stage.rejectionThreshold ?? null,
          requireAllReviewers: stage.requireAllReviewers ?? false,
          allowSelfApproval: stage.allowSelfApproval ?? false,
          ownerRequired: stage.ownerRequired ?? false,
          expiresAfterHours: stage.expiresAfterHours ?? null,
          escalationAfterHours: stage.escalationAfterHours ?? null,
          reviewers: {
            create: stage.reviewers.map((r) => ({
              reviewerType: r.reviewerType,
              role: r.role || null,
              memberId: r.memberId || null,
              permission: r.permission || null,
              required: r.required ?? false,
            })),
          },
        })),
      },
    },
    include: {
      stages: {
        include: { reviewers: true },
        orderBy: { order: "asc" },
      },
    },
  })

  await createAuditLog({
    userId: data.createdById,
    circleId: data.circleId,
    action: "CREATED",
    entityType: "ApprovalWorkflow",
    entityId: workflow.id,
    newValues: {
      name: data.name,
      type: data.type,
      stagesCount: data.stages.length,
      status: "DRAFT",
    },
  })

  return workflow
}

// ─── 3. Get Workflows ────────────────────────────────────

export async function getWorkflows(
  circleId: string,
  filters?: { type?: ApprovalType; status?: ApprovalWorkflowStatus }
) {
  const where: Record<string, unknown> = { circleId }
  if (filters?.type) where.type = filters.type
  if (filters?.status) where.status = filters.status

  return prisma.approvalWorkflow.findMany({
    where: where as any,
    include: {
      stages: {
        include: { reviewers: true },
        orderBy: { order: "asc" },
      },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { stages: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })
}

// ─── 4. Get Workflow by ID ───────────────────────────────

export async function getWorkflowById(workflowId: string) {
  return prisma.approvalWorkflow.findUnique({
    where: { id: workflowId },
    include: {
      stages: {
        include: { reviewers: true },
        orderBy: { order: "asc" },
      },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  })
}

// ─── 5. Update Workflow ──────────────────────────────────

export async function updateWorkflow(data: {
  workflowId: string
  userId: string
  name?: string | null
  description?: string | null
  priority?: number | null
  minimumAmount?: number | null
  maximumAmount?: number | null
  currency?: string | null
  isDefault?: boolean | null
  stages?: WorkflowStageInput[] | null
}) {
  const existing = await prisma.approvalWorkflow.findUnique({ where: { id: data.workflowId } })
  if (!existing) throw new Error("Workflow not found")
  if (existing.status === "ARCHIVED") throw new Error("Cannot edit archived workflow")

  await requireCirclePermission({
    userId: data.userId,
    circleId: existing.circleId,
    permission: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_UPDATE,
  })

  // If stages are being replaced, validate them first
  if (data.stages) {
    const validation = await validateWorkflow({
      circleId: existing.circleId,
      stages: data.stages,
      isDefault: data.isDefault ?? existing.isDefault,
      type: existing.type,
      workflowId: data.workflowId,
    })
    if (!validation.valid) {
      throw new Error(
        `Workflow validation failed: ${validation.errors.map((e) => e.message).join("; ")}`
      )
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name != null) updateData.name = data.name
  if (data.description != null) updateData.description = data.description
  if (data.priority != null) updateData.priority = data.priority
  if (data.minimumAmount != null) updateData.minimumAmount = data.minimumAmount
  if (data.maximumAmount != null) updateData.maximumAmount = data.maximumAmount
  if (data.currency != null) updateData.currency = data.currency

  if (data.isDefault === true) {
    await prisma.approvalWorkflow.updateMany({
      where: {
        circleId: existing.circleId,
        type: existing.type,
        isDefault: true,
        NOT: { id: data.workflowId },
      },
      data: { isDefault: false },
    })
    updateData.isDefault = true
  } else if (data.isDefault === false) {
    updateData.isDefault = false
  }

  // Replace stages atomically
  if (data.stages) {
    const sortedStages = [...data.stages].sort((a, b) => a.order - b.order)

    await prisma.approvalWorkflowStage.deleteMany({
      where: { workflowId: data.workflowId },
    })

    for (const stage of sortedStages) {
      await prisma.approvalWorkflowStage.create({
        data: {
          workflowId: data.workflowId,
          name: stage.name,
          description: stage.description || null,
          order: stage.order,
          mode: stage.mode,
          minimumApprovals: stage.minimumApprovals,
          rejectionThreshold: stage.rejectionThreshold ?? null,
          requireAllReviewers: stage.requireAllReviewers ?? false,
          allowSelfApproval: stage.allowSelfApproval ?? false,
          ownerRequired: stage.ownerRequired ?? false,
          expiresAfterHours: stage.expiresAfterHours ?? null,
          escalationAfterHours: stage.escalationAfterHours ?? null,
          reviewers: {
            create: stage.reviewers.map((r) => ({
              reviewerType: r.reviewerType,
              role: r.role || null,
              memberId: r.memberId || null,
              permission: r.permission || null,
              required: r.required ?? false,
            })),
          },
        },
      })
    }

    updateData.version = existing.version + 1
  }

  const workflow = await prisma.approvalWorkflow.update({
    where: { id: data.workflowId },
    data: updateData as any,
    include: {
      stages: {
        include: { reviewers: true },
        orderBy: { order: "asc" },
      },
    },
  })

  await createAuditLog({
    userId: data.userId,
    circleId: existing.circleId,
    action: "UPDATED",
    entityType: "ApprovalWorkflow",
    entityId: data.workflowId,
    newValues: { ...updateData, stagesChanged: data.stages != null },
  })

  return workflow
}

// ─── 6. Change Workflow Status ───────────────────────────

export async function changeWorkflowStatus(data: {
  workflowId: string
  userId: string
  status: ApprovalWorkflowStatus
}) {
  const existing = await prisma.approvalWorkflow.findUnique({ where: { id: data.workflowId } })
  if (!existing) throw new Error("Workflow not found")

  const permissionMap: Record<string, string> = {
    ACTIVE: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_ACTIVATE,
    INACTIVE: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_UPDATE,
    DRAFT: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_UPDATE,
    ARCHIVED: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_ARCHIVE,
  }

  await requireCirclePermission({
    userId: data.userId,
    circleId: existing.circleId,
    permission: permissionMap[data.status] as any,
  })

  // Validate activation: must have at least one stage with reviewers
  if (data.status === "ACTIVE") {
    const validation = await validateWorkflowForActivation(data.workflowId)
    if (!validation.valid) {
      throw new Error(
        `Cannot activate: ${validation.errors.map((e) => e.message).join("; ")}`
      )
    }
  }

  // Cannot reactivate archived workflows
  if (data.status !== "ARCHIVED" && existing.status === "ARCHIVED") {
    throw new Error("Cannot change status of an archived workflow")
  }

  const oldStatus = existing.status

  const workflow = await prisma.approvalWorkflow.update({
    where: { id: data.workflowId },
    data: {
      status: data.status,
      ...(data.status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
    },
    include: {
      stages: { include: { reviewers: true }, orderBy: { order: "asc" } },
    },
  })

  await createAuditLog({
    userId: data.userId,
    circleId: existing.circleId,
    action: data.status,
    entityType: "ApprovalWorkflow",
    entityId: data.workflowId,
    oldValues: { status: oldStatus },
    newValues: { status: data.status },
  })

  return workflow
}

// ─── 7. Select Workflow for Request ──────────────────────
// Deterministic selection: circle → type → currency → amount
// range → priority desc → createdAt desc → default fallback.
// Once returned, snapshot is immutable.

export async function selectWorkflowForRequest(params: {
  circleId: string
  type: ApprovalType
  amount?: number | null
  currency?: string | null
}) {
  const { circleId, type, amount, currency } = params

  const workflows = await prisma.approvalWorkflow.findMany({
    where: { circleId, type, status: "ACTIVE" },
    include: {
      stages: {
        include: { reviewers: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })

  for (const wf of workflows) {
    if (wf.currency && currency && wf.currency !== currency) continue

    if (amount != null) {
      if (wf.minimumAmount != null && amount < Number(wf.minimumAmount)) continue
      if (wf.maximumAmount != null && amount > Number(wf.maximumAmount)) continue
    }

    return wf
  }

  return null
}

// Alias kept for backward compatibility with engine service import
export { selectWorkflowForRequest as resolveWorkflow }

// ─── 8. Build Workflow Snapshot ──────────────────────────
// Creates an immutable JSON snapshot of the workflow at the
// time the request was created. Never re-reads workflow config.

export function buildWorkflowSnapshot(workflow: {
  id: string
  name: string
  version: number
  type: string
  stages: Array<{
    name: string
    order: number
    mode: string
    minimumApprovals: number
    rejectionThreshold?: number | null
    requireAllReviewers?: boolean
    allowSelfApproval?: boolean
    ownerRequired?: boolean
    expiresAfterHours?: number | null
    escalationAfterHours?: number | null
  }>
}): Record<string, unknown> {
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowVersion: workflow.version,
    workflowType: workflow.type,
    stagesCount: workflow.stages.length,
    capturedAt: new Date().toISOString(),
    stages: workflow.stages.map((s) => ({
      name: s.name,
      order: s.order,
      mode: s.mode,
      minimumApprovals: s.minimumApprovals,
      rejectionThreshold: s.rejectionThreshold ?? null,
      requireAllReviewers: s.requireAllReviewers ?? false,
      allowSelfApproval: s.allowSelfApproval ?? false,
      ownerRequired: s.ownerRequired ?? false,
      expiresAfterHours: s.expiresAfterHours ?? null,
      escalationAfterHours: s.escalationAfterHours ?? null,
    })),
  }
}

// ─── 9. Delete Workflow (hard) ───────────────────────────

export async function deleteWorkflow(data: { workflowId: string; userId: string }) {
  const existing = await prisma.approvalWorkflow.findUnique({
    where: { id: data.workflowId },
    select: { id: true, circleId: true, status: true, name: true },
  })
  if (!existing) throw new Error("Workflow not found")

  await requireCirclePermission({
    userId: data.userId,
    circleId: existing.circleId,
    permission: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_ARCHIVE,
  })

  // Check if any pending requests reference this workflow
  const activeRequests = await prisma.approvalRequest.count({
    where: {
      circleId: existing.circleId,
      status: "PENDING",
      workflowSnapshot: { path: ["workflowId"], equals: data.workflowId },
    },
  })

  if (activeRequests > 0) {
    throw new Error(
      `Cannot delete workflow with ${activeRequests} active approval request(s). Archive it instead.`
    )
  }

  await prisma.approvalWorkflow.delete({ where: { id: data.workflowId } })

  await createAuditLog({
    userId: data.userId,
    circleId: existing.circleId,
    action: "DELETED",
    entityType: "ApprovalWorkflow",
    entityId: data.workflowId,
    oldValues: { name: existing.name, status: existing.status },
  })

  return { success: true }
}

// ─── Helpers ──────────────────────────────────────────────

async function validateWorkflowForActivation(
  workflowId: string
): Promise<WorkflowValidationResult> {
  const errors: WorkflowValidationError[] = []
  const warnings: WorkflowValidationError[] = []

  const stages = await prisma.approvalWorkflowStage.findMany({
    where: { workflowId },
    include: { _count: { select: { reviewers: true } } },
    orderBy: { order: "asc" },
  })

  if (stages.length === 0) {
    errors.push({ field: "stages", code: "NO_STAGES", message: "Workflow must have at least one stage" })
    return { valid: false, errors, warnings }
  }

  for (const stage of stages) {
    if (stage._count.reviewers === 0) {
      errors.push({
        field: `stage:${stage.id}`,
        code: "NO_REVIEWERS",
        message: `Stage "${stage.name}" must have at least one reviewer`,
      })
    }
  }

  // Check sequential order gaps
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].order !== i + 1) {
      errors.push({
        field: `stage:${stages[i].id}`,
        code: "ORDER_GAP",
        message: `Stage order must be sequential from 1. Expected ${i + 1}, got ${stages[i].order}`,
      })
      break
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
