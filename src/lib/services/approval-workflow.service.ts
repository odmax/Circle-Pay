import { prisma } from "@/lib/prisma"
import type { ApprovalWorkflowStatus, ApprovalType } from "@/generated/prisma"
import { requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"

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

// ─── 1. Create Workflow ───────────────────────────────────

export async function createWorkflow(data: WorkflowCreateInput) {
  await requireCirclePermission({ userId: data.createdById, circleId: data.circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_CREATE })

  // Validate stages
  if (data.stages.length === 0) throw new Error("Workflow must have at least one stage")
  
  const sortedStages = [...data.stages].sort((a, b) => a.order - b.order)
  for (let i = 0; i < sortedStages.length; i++) {
    if (sortedStages[i].order !== i + 1) throw new Error(`Stage order must be sequential starting from 1. Expected ${i + 1}, got ${sortedStages[i].order}`)
    if (sortedStages[i].reviewers.length === 0) throw new Error(`Stage "${sortedStages[i].name}" must have at least one reviewer`)
  }

  // If marking as default, unset other defaults
  if (data.isDefault) {
    await prisma.approvalWorkflow.updateMany({
      where: { circleId: data.circleId, type: data.type, isDefault: true },
      data: { isDefault: false },
    })
  }

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
    newValues: { name: data.name, type: data.type, stagesCount: data.stages.length, status: "DRAFT" },
  })

  return workflow
}

// ─── 2. Get Workflows ────────────────────────────────────

export async function getWorkflows(circleId: string, filters?: { type?: ApprovalType; status?: ApprovalWorkflowStatus }) {
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

// ─── 3. Get Workflow by ID ───────────────────────────────

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

// ─── 4. Update Workflow ──────────────────────────────────

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

  await requireCirclePermission({ userId: data.userId, circleId: existing.circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_UPDATE })

  const updateData: Record<string, unknown> = {}
  if (data.name != null) updateData.name = data.name
  if (data.description != null) updateData.description = data.description
  if (data.priority != null) updateData.priority = data.priority
  if (data.minimumAmount != null) updateData.minimumAmount = data.minimumAmount
  if (data.maximumAmount != null) updateData.maximumAmount = data.maximumAmount
  if (data.currency != null) updateData.currency = data.currency

  if (data.isDefault === true) {
    await prisma.approvalWorkflow.updateMany({
      where: { circleId: existing.circleId, type: existing.type, isDefault: true, NOT: { id: data.workflowId } },
      data: { isDefault: false },
    })
    updateData.isDefault = true
  } else if (data.isDefault === false) {
    updateData.isDefault = false
  }

  // If stages are provided, replace them atomically
  if (data.stages) {
    if (data.stages.length === 0) throw new Error("Workflow must have at least one stage")
    
    const sortedStages = [...data.stages].sort((a, b) => a.order - b.order)
    for (let i = 0; i < sortedStages.length; i++) {
      if (sortedStages[i].order !== i + 1) throw new Error(`Stage order must be sequential starting from 1`)
      if (sortedStages[i].reviewers.length === 0) throw new Error(`Stage "${sortedStages[i].name}" must have at least one reviewer`)
    }

    // Delete existing stages (cascades to reviewers)
    await prisma.approvalWorkflowStage.deleteMany({ where: { workflowId: data.workflowId } })

    // Create new stages
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

    // Bump version
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

// ─── 5. Change Workflow Status ───────────────────────────

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

  await requireCirclePermission({ userId: data.userId, circleId: existing.circleId, permission: permissionMap[data.status] as any })

  // Validate activation: must have at least one stage with reviewers
  if (data.status === "ACTIVE") {
    const stages = await prisma.approvalWorkflowStage.findMany({
      where: { workflowId: data.workflowId },
      include: { _count: { select: { reviewers: true } } },
    })
    if (stages.length === 0) throw new Error("Cannot activate workflow with no stages")
    if (stages.some((s) => s._count.reviewers === 0)) throw new Error("All stages must have at least one reviewer")
  }

  const oldStatus = existing.status

  // If activating, optionally deactivate other active workflows of same type
  if (data.status === "ACTIVE" && !existing.isDefault) {
    // Don't automatically deactivate others; let user decide
  }

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

// ─── 6. Resolve Workflow for Request ─────────────────────

export async function resolveWorkflow(params: {
  circleId: string
  type: ApprovalType
  amount?: number | null
  currency?: string | null
}) {
  const { circleId, type, amount, currency } = params

  // Get all active workflows for this type, ordered by priority desc then amount range match
  const workflows = await prisma.approvalWorkflow.findMany({
    where: {
      circleId,
      type,
      status: "ACTIVE",
    },
    include: {
      stages: {
        include: { reviewers: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })

  // Find best matching workflow
  for (const wf of workflows) {
    // Currency match
    if (wf.currency && currency && wf.currency !== currency) continue
    
    // Amount range match
    if (amount != null) {
      if (wf.minimumAmount != null && amount < Number(wf.minimumAmount)) continue
      if (wf.maximumAmount != null && amount > Number(wf.maximumAmount)) continue
    }

    return wf
  }

  return null
}

// ─── 7. Delete Workflow (soft) ───────────────────────────

export async function deleteWorkflow(data: { workflowId: string; userId: string }) {
  const existing = await prisma.approvalWorkflow.findUnique({
    where: { id: data.workflowId },
    select: { id: true, circleId: true, status: true, name: true },
  })
  if (!existing) throw new Error("Workflow not found")

  await requireCirclePermission({ userId: data.userId, circleId: existing.circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_WORKFLOW_ARCHIVE })

  // Check if any pending requests reference this workflow
  const activeRequests = await prisma.approvalRequest.count({
    where: {
      circleId: existing.circleId,
      status: "PENDING",
      workflowSnapshot: { path: ["workflowId"], equals: data.workflowId },
    },
  })

  if (activeRequests > 0) {
    throw new Error(`Cannot delete workflow with ${activeRequests} active approval request(s). Archive it instead.`)
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
