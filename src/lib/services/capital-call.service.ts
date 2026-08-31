import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { createProjectContribution } from "@/lib/services/project-funding.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface CapitalCallView {
  id: string
  title: string
  purpose: string | null
  amountRequired: number
  allocationMethod: string
  minimumContribution: number | null
  status: string
  dueDate: string | null
  issuedAt: string | null
  opportunityId: string | null
  projectId: string | null
  targetName: string | null
  totals: { requested: number; committed: number; paid: number; outstanding: number }
  my: { requested: number | null; committed: number; paid: number; outstanding: number; dueDate: string | null }
}

export async function callTargetName(call: { projectId: string | null; opportunityId: string | null }) {
  if (call.projectId) {
    const p = await prisma.project.findUnique({ where: { id: call.projectId }, select: { name: true } })
    return p?.name ?? null
  }
  if (call.opportunityId) {
    const o = await prisma.investmentOpportunity.findUnique({ where: { id: call.opportunityId }, select: { title: true } })
    return o?.title ?? null
  }
  return null
}

async function callMetrics(call: { id: string; projectId: string | null; opportunityId: string | null }) {
  const committedOf = (rows: Array<{ userId: string; amount: unknown; status: string }>) => rows.filter((r) => ["PENDING", "PAID", "CONFIRMED"].includes(r.status)).reduce((s, r) => s + asNum(r.amount), 0)
  const paidOf = (rows: Array<{ userId: string; amount: unknown; status: string }>) => rows.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + asNum(r.amount), 0)

  if (call.projectId) {
    const rows: Array<{ userId: string; amount: unknown; status: string }> = await prisma.projectContribution.findMany({
      where: { projectId: call.projectId, metadata: { path: ["capitalCallId"], equals: call.id } },
      select: { userId: true, amount: true, status: true },
    })
    return { committedOf, paidOf, rows }
  }
  if (call.opportunityId) {
    const rows: Array<{ userId: string; amount: unknown; status: string }> = await prisma.investmentOpportunityCommitment.findMany({
      where: { opportunityId: call.opportunityId, metadata: { path: ["capitalCallId"], equals: call.id } },
      select: { userId: true, amount: true, status: true },
    })
    return { committedOf, paidOf, rows }
  }
  return { committedOf, paidOf, rows: [] as Array<{ userId: string; amount: unknown; status: string }> }
}

export async function listCapitalCalls(circleId: string, viewerUserId: string) {
  const calls = await prisma.capitalCall.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } })
  const result: CapitalCallView[] = []
  for (const call of calls) {
    const allocations = await prisma.capitalCallAllocation.findMany({ where: { capitalCallId: call.id } })
    const metrics = await callMetrics(call)
    const requested = allocations.reduce((s, a) => s + asNum(a.requestedAmount), 0)
    const committed = metrics.committedOf(metrics.rows)
    const paid = metrics.paidOf(metrics.rows)
    const mine = allocations.find((a) => a.userId === viewerUserId)
    const myRequested = mine?.requestedAmount != null ? asNum(mine.requestedAmount) : null
    const myCommitted = metrics.rows.filter((r) => r.userId === viewerUserId && ["PENDING", "PAID", "CONFIRMED"].includes(r.status)).reduce((s, r) => s + asNum(r.amount), 0)
    const myPaid = metrics.rows.filter((r) => r.userId === viewerUserId && r.status === "CONFIRMED").reduce((s, r) => s + asNum(r.amount), 0)
    result.push({
      id: call.id,
      title: call.title,
      purpose: call.purpose,
      amountRequired: asNum(call.amountRequired),
      allocationMethod: call.allocationMethod,
      minimumContribution: call.minimumContribution != null ? asNum(call.minimumContribution) : null,
      status: call.status,
      dueDate: call.dueDate ? call.dueDate.toISOString() : null,
      issuedAt: call.issuedAt ? call.issuedAt.toISOString() : null,
      opportunityId: call.opportunityId,
      projectId: call.projectId,
      targetName: await callTargetName(call),
      totals: { requested, committed, paid, outstanding: Math.max(0, requested - paid) },
      my: {
        requested: myRequested,
        committed: myCommitted,
        paid: myPaid,
        outstanding: Math.max(0, (myRequested ?? 0) - myPaid),
        dueDate: call.dueDate ? call.dueDate.toISOString() : null,
      },
    })
  }
  const openCalls = result.filter((c) => c.status === "OPEN")
  return {
    calls: result,
    openCalls,
    myOutstandingCalls: openCalls.map((c) => ({ id: c.id, title: c.title, outstanding: c.my.outstanding, dueDate: c.my.dueDate })).filter((c) => c.outstanding > 0),
  }
}

export async function getCapitalCallDetail(circleId: string, callId: string, viewerUserId: string) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  const allocations = await prisma.capitalCallAllocation.findMany({ where: { capitalCallId: callId }, include: { user: { select: { name: true } } } })
  const metrics = await callMetrics(call)
  const targetName = await callTargetName(call)
  const mine = allocations.find((a) => a.userId === viewerUserId)
  const myPaid = metrics.rows.filter((r) => r.userId === viewerUserId && r.status === "CONFIRMED").reduce((s, r) => s + asNum(r.amount), 0)
  return {
    call: {
      id: call.id,
      title: call.title,
      purpose: call.purpose,
      amountRequired: asNum(call.amountRequired),
      allocationMethod: call.allocationMethod,
      minimumContribution: call.minimumContribution != null ? asNum(call.minimumContribution) : null,
      status: call.status,
      issuedAt: call.issuedAt ? call.issuedAt.toISOString() : null,
      dueDate: call.dueDate ? call.dueDate.toISOString() : null,
      opportunityId: call.opportunityId,
      projectId: call.projectId,
      targetName,
    },
    allocations: allocations.map((a) => ({
      userId: a.userId,
      name: a.user?.name ?? a.userId,
      requestedAmount: a.requestedAmount != null ? asNum(a.requestedAmount) : null,
      paid: metrics.rows.filter((r) => r.userId === a.userId && r.status === "CONFIRMED").reduce((s, r) => s + asNum(r.amount), 0),
    })),
    my: { requestedAmount: mine?.requestedAmount != null ? asNum(mine.requestedAmount) : null, paid: myPaid },
    entries: metrics.rows.map((r) => ({ userId: r.userId, amount: asNum(r.amount), status: r.status })),
  }
}

export async function createCapitalCall(circleId: string, userId: string, data: {
  title: string
  purpose?: string
  amountRequired: number
  allocationMethod?: string
  minimumContribution?: number
  dueDate?: string | null
  opportunityId?: string | null
  projectId?: string | null
  allocations?: Array<{ userId: string; requestedAmount: number }>
}) {
  const title = (data.title || "").trim()
  if (!title) throw new Error("Title is required")
  if (!data.amountRequired || data.amountRequired <= 0) throw new Error("Amount required must be greater than zero")
  if (data.opportunityId && data.projectId) throw new Error("A capital call targets either an opportunity or a project, not both")
  const method = data.allocationMethod || "EQUAL"

  const call = await prisma.capitalCall.create({
    data: {
      circleId, createdById: userId,
      title, purpose: data.purpose ?? null,
      amountRequired: data.amountRequired,
      allocationMethod: method as "EQUAL" | "PERCENTAGE" | "CUSTOM" | "OPEN",
      minimumContribution: data.minimumContribution ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      opportunityId: data.opportunityId ?? null,
      projectId: data.projectId ?? null,
    },
  })
  if (method === "CUSTOM" && data.allocations?.length) {
    for (const a of data.allocations) {
      await upsertAllocation(call.id, a.userId, a.requestedAmount)
    }
  }
  await createAuditLog({ userId, circleId, action: "CAPITAL_CALL_CREATED", entityType: "CapitalCall", entityId: call.id, newValues: { title, amountRequired: data.amountRequired } })
  return call
}

async function upsertAllocation(callId: string, userId: string, requestedAmount?: number | null) {
  const existing = await prisma.capitalCallAllocation.findFirst({ where: { capitalCallId: callId, userId } })
  if (existing) {
    return prisma.capitalCallAllocation.update({
      where: { id: existing.id },
      data: { requestedAmount: requestedAmount ?? existing.requestedAmount },
    })
  }
  return prisma.capitalCallAllocation.create({
    data: { capitalCallId: callId, userId, requestedAmount: requestedAmount ?? null },
  })
}

export async function issueCapitalCall(circleId: string, callId: string, userId: string) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  if (call.status !== "DRAFT") throw new Error("Only DRAFT capital calls can be issued")

  const existingAllocations = await prisma.capitalCallAllocation.count({ where: { capitalCallId: callId } })
  if (existingAllocations === 0 && ["EQUAL", "PERCENTAGE"].includes(call.allocationMethod)) {
    const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
    if (members.length === 0) throw new Error("No members to allocate to")
    const required = asNum(call.amountRequired)
    const base = Math.floor((required / members.length) * 100) / 100
    for (let i = 0; i < members.length; i++) {
      const amount = i === members.length - 1 ? Math.round((required - base * (members.length - 1)) * 100) / 100 : base
      await upsertAllocation(callId, members[i].userId, amount)
    }
  }

  const updated = await prisma.capitalCall.update({ where: { id: callId }, data: { status: "OPEN", issuedAt: new Date(), openedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "CAPITAL_CALL_ISSUED", entityType: "CapitalCall", entityId: callId })
  const { notifyCircleMembers } = await import("@/lib/services/notification.service")
  await notifyCircleMembers(circleId, userId, {
    type: "CAPITAL_CALL_ISSUED",
    title: `Capital call: ${call.title}`,
    message: `${asNum(call.amountRequired).toLocaleString()} requested${call.dueDate ? ` by ${call.dueDate.toDateString()}` : ""}.`,
    link: `/circles/${circleId}/capital-calls/${callId}`,
  }).catch(() => {})
  return updated
}

export async function updateCapitalCall(circleId: string, callId: string, userId: string, data: Record<string, unknown>) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  if (call.status !== "DRAFT" && call.status !== "OPEN") throw new Error("Only DRAFT or OPEN capital calls can be edited")
  const safe: Record<string, unknown> = {}
  for (const k of ["title", "purpose", "amountRequired", "minimumContribution", "dueDate"]) {
    if (data[k] !== undefined) safe[k] = data[k] === "" || data[k] === null ? null : k === "dueDate" && data[k] ? new Date(data[k] as string) : data[k]
  }
  const updated = await prisma.capitalCall.update({ where: { id: callId }, data: safe as Prisma.CapitalCallUpdateInput })
  await createAuditLog({ userId, circleId, action: "CAPITAL_CALL_UPDATED", entityType: "CapitalCall", entityId: callId, newValues: safe })
  return updated
}

export async function closeCapitalCall(circleId: string, callId: string, userId: string) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  if (call.status !== "OPEN") throw new Error("Only OPEN capital calls can be closed")
  const updated = await prisma.capitalCall.update({ where: { id: callId }, data: { status: "CLOSED", closedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "CAPITAL_CALL_CLOSED", entityType: "CapitalCall", entityId: callId })
  return updated
}

export async function completeCapitalCall(circleId: string, callId: string, userId: string) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  const updated = await prisma.capitalCall.update({ where: { id: callId }, data: { status: "COMPLETED", closedAt: new Date(), fundedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "CAPITAL_CALL_COMPLETED", entityType: "CapitalCall", entityId: callId })
  return updated
}

export async function cancelCapitalCall(circleId: string, callId: string, userId: string) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  const updated = await prisma.capitalCall.update({ where: { id: callId }, data: { status: "CANCELLED", closedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "CAPITAL_CALL_CANCELLED", entityType: "CapitalCall", entityId: callId })
  return updated
}

// Member pays toward their capital-call allocation. Payment reuses the existing
// project contribution / opportunity commitment + proof infrastructure and is
// tagged with metadata.capitalCallId so posted amounts are never double-counted.
export async function payCapitalCall(circleId: string, callId: string, userId: string, data: { amount: number; reference?: string }) {
  const call = await prisma.capitalCall.findFirst({ where: { id: callId, circleId } })
  if (!call) throw new Error("Capital call not found")
  if (call.status !== "OPEN") throw new Error("This capital call is not open")

  await upsertAllocation(callId, userId, null)

  if (call.projectId) {
    const contribution = await createProjectContribution(call.projectId, userId, {
      amount: data.amount,
      fundingRoundId: undefined,
      reference: data.reference,
    })
    await prisma.projectContribution.update({ where: { id: contribution.id }, data: { metadata: { capitalCallId: call.id } } })
    return { kind: "project" as const, id: contribution.id, status: contribution.status }
  }

  if (call.opportunityId) {
    const opp = await prisma.investmentOpportunity.findFirst({ where: { id: call.opportunityId, circleId } })
    if (!opp) throw new Error("Opportunity not found")
    if (opp.status !== "OPEN") throw new Error("The linked opportunity is not open")
    if (call.minimumContribution != null && data.amount < asNum(call.minimumContribution)) throw new Error(`Minimum contribution is ${asNum(call.minimumContribution).toLocaleString()}`)
    const commitment = await prisma.investmentOpportunityCommitment.create({
      data: { opportunityId: opp.id, userId, amount: data.amount, status: "PENDING", metadata: { capitalCallId: call.id } },
    })
    return { kind: "opportunity" as const, id: commitment.id, opportunityId: opp.id, status: commitment.status }
  }

  throw new Error("Capital call must target a project or an opportunity")
}

// Reminder sweep: notify overdue capital calls (idempotent via metadata sentinels).
export async function sweepCapitalCallReminders(circleId: string) {
  const calls = await prisma.capitalCall.findMany({ where: { circleId, status: "OPEN", dueDate: { not: null } } })
  const { createNotification } = await import("@/lib/services/notification.service")
  const results: string[] = []
  for (const call of calls) {
    const due = call.dueDate ? new Date(call.dueDate) : null
    if (!due) continue
    const overdue = due < new Date()
    const meta = (call.metadata ?? {}) as Record<string, unknown>
      const flagged = meta.notifiedOverdue === true
    if (overdue && !flagged) {
      const allocations = await prisma.capitalCallAllocation.findMany({ where: { capitalCallId: call.id } })
      await prisma.capitalCall.update({ where: { id: call.id }, data: { metadata: { ...(meta), notifiedOverdue: true } } })
      for (const a of allocations) {
        await createNotification({
          userId: a.userId,
          circleId,
          type: "CAPITAL_CALL_OVERDUE",
          title: `Capital call overdue: ${call.title}`,
          message: `The capital call was due ${due.toDateString()}.`,
          link: `/circles/${circleId}/capital-calls/${call.id}`,
        }).catch(() => {})
      }
      results.push(`notified:${call.id}:overdue`)
    }
  }
  return results
}