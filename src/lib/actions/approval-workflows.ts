"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  approvalDecisionSchema,
  createDelegationSchema,
} from "@/lib/validations/approval-workflows"
import {
  createWorkflow,
  updateWorkflow,
  changeWorkflowStatus,
} from "@/lib/services/approval-workflow.service"
import { processStageDecision } from "@/lib/services/approval-workflow-engine.service"
import { approveRequest, rejectRequest, cancelRequest } from "@/lib/services/approval.service"
import { createDelegation, revokeDelegation } from "@/lib/services/delegation.service"

type ActionResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

// ─── 1. Create Workflow ───────────────────────────────────

export async function createWorkflowAction(
  circleId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const raw = {
      name: formData.get("name"),
      description: formData.get("description"),
      type: formData.get("type"),
      priority: formData.get("priority") ? Number(formData.get("priority")) : undefined,
      minimumAmount: formData.get("minimumAmount") ? Number(formData.get("minimumAmount")) : undefined,
      maximumAmount: formData.get("maximumAmount") ? Number(formData.get("maximumAmount")) : undefined,
      currency: formData.get("currency") || undefined,
      isDefault: formData.get("isDefault") === "true",
      stages: formData.get("stages") ? JSON.parse(formData.get("stages") as string) : undefined,
    }

    const parsed = createWorkflowSchema.parse(raw)

    const workflow = await createWorkflow({
      ...parsed,
      circleId,
      createdById: session.user.id,
    })

    revalidatePath(`/circles/${circleId}/approvals/workflows`)
    revalidatePath(`/circles/${circleId}`)

    return { success: true, data: workflow }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workflow"
    return { success: false, error: message }
  }
}

// ─── 2. Update Workflow ───────────────────────────────────

export async function updateWorkflowAction(
  circleId: string,
  workflowId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const raw: Record<string, unknown> = {}

    const name = formData.get("name")
    if (name != null) raw.name = name

    const description = formData.get("description")
    if (description != null) raw.description = description

    const priority = formData.get("priority")
    if (priority != null) raw.priority = Number(priority)

    const minimumAmount = formData.get("minimumAmount")
    if (minimumAmount != null) raw.minimumAmount = Number(minimumAmount)

    const maximumAmount = formData.get("maximumAmount")
    if (maximumAmount != null) raw.maximumAmount = Number(maximumAmount)

    const currency = formData.get("currency")
    if (currency != null) raw.currency = currency

    const isDefault = formData.get("isDefault")
    if (isDefault != null) raw.isDefault = isDefault === "true"

    const stages = formData.get("stages")
    if (stages != null) raw.stages = JSON.parse(stages as string)

    const parsed = updateWorkflowSchema.parse(raw)

    const workflow = await updateWorkflow({
      workflowId,
      userId: session.user.id,
      ...parsed,
    })

    revalidatePath(`/circles/${circleId}/approvals/workflows`)
    revalidatePath(`/circles/${circleId}/approvals/workflows/${workflowId}`)

    return { success: true, data: workflow }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workflow"
    return { success: false, error: message }
  }
}

// ─── 3. Activate Workflow ─────────────────────────────────

export async function activateWorkflowAction(
  circleId: string,
  workflowId: string
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const workflow = await changeWorkflowStatus({
      workflowId,
      userId: session.user.id,
      status: "ACTIVE",
    })

    revalidatePath(`/circles/${circleId}/approvals/workflows`)
    revalidatePath(`/circles/${circleId}/approvals/workflows/${workflowId}`)

    return { success: true, data: workflow }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate workflow"
    return { success: false, error: message }
  }
}

// ─── 4. Archive Workflow ──────────────────────────────────

export async function archiveWorkflowAction(
  circleId: string,
  workflowId: string
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const workflow = await changeWorkflowStatus({
      workflowId,
      userId: session.user.id,
      status: "ARCHIVED",
    })

    revalidatePath(`/circles/${circleId}/approvals/workflows`)
    revalidatePath(`/circles/${circleId}/approvals/workflows/${workflowId}`)

    return { success: true, data: workflow }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to archive workflow"
    return { success: false, error: message }
  }
}

// ─── 5. Decide Approval ───────────────────────────────────

export async function decideApprovalAction(
  circleId: string,
  approvalId: string,
  data: { decision: "APPROVE" | "REJECT"; comment?: string; stageId?: string }
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const parsed = approvalDecisionSchema.parse(data)

    let result
    if (parsed.stageId) {
      result = await processStageDecision({
        approvalRequestId: approvalId,
        requestStageId: parsed.stageId,
        reviewerId: session.user.id,
        decision: parsed.decision,
        comment: parsed.comment,
      })
    } else if (parsed.decision === "APPROVE") {
      result = await approveRequest({
        approvalRequestId: approvalId,
        reviewerId: session.user.id,
        comment: parsed.comment,
      })
    } else {
      result = await rejectRequest({
        approvalRequestId: approvalId,
        reviewerId: session.user.id,
        comment: parsed.comment,
      })
    }

    revalidatePath(`/circles/${circleId}/approvals`)
    revalidatePath(`/circles/${circleId}/approvals/${approvalId}`)

    return { success: true, data: result }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record decision"
    return { success: false, error: message }
  }
}

// ─── 6. Cancel Approval ───────────────────────────────────

export async function cancelApprovalAction(
  circleId: string,
  approvalId: string
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const result = await cancelRequest({
      approvalRequestId: approvalId,
      userId: session.user.id,
    })

    revalidatePath(`/circles/${circleId}/approvals`)
    revalidatePath(`/circles/${circleId}/approvals/${approvalId}`)

    return { success: true, data: result }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel approval"
    return { success: false, error: message }
  }
}

// ─── 7. Create Delegation ─────────────────────────────────

export async function createDelegationAction(
  circleId: string,
  data: {
    delegateMemberId: string
    approvalType?: string | null
    workflowId?: string | null
    stageId?: string | null
    startsAt?: string | null
    endsAt: string
    reason?: string | null
  }
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const parsed = createDelegationSchema.parse(data)

    const delegation = await createDelegation({
      circleId,
      delegatorMemberId: session.user.id,
      delegateMemberId: parsed.delegateMemberId,
      approvalType: parsed.approvalType as any ?? null,
      workflowId: parsed.workflowId ?? null,
      stageId: parsed.stageId ?? null,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: new Date(parsed.endsAt),
      reason: parsed.reason ?? null,
      createdById: session.user.id,
    })

    revalidatePath(`/circles/${circleId}/approvals/delegations`)

    return { success: true, data: delegation }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create delegation"
    return { success: false, error: message }
  }
}

// ─── 8. Revoke Delegation ─────────────────────────────────

export async function revokeDelegationAction(
  circleId: string,
  delegationId: string
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  try {
    const result = await revokeDelegation({
      delegationId,
      userId: session.user.id,
    })

    revalidatePath(`/circles/${circleId}/approvals/delegations`)

    return { success: true, data: result }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke delegation"
    return { success: false, error: message }
  }
}
