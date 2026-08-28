import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification, notifyCircleMembers } from "@/lib/services/notification.service"
import { createApprovalRequest } from "@/lib/services/approval.service"

type Decimal = Prisma.Decimal

const CONFIRMED_CONTRIBUTION_STATUSES = ["CONFIRMED", "PAID"] as const
const PAID_PAYOUT_STATUSES = ["PAID", "CONFIRMED_RECEIVED", "COMPLETED"] as const
const OUTSTANDING_CONTRIBUTION_STATUSES = ["DUE", "OVERDUE", "PENDING", "UPCOMING"] as const

type YearEndCloseStatus = Prisma.YearEndCloseGetPayload<{}>["status"]

function dec(value: string | number | Decimal | null | undefined): Decimal {
  return new Prisma.Decimal(value ?? 0)
}

function sumDecimal(values: (Decimal | string | number | null | undefined)[]): Decimal {
  let acc = new Prisma.Decimal(0)
  for (const v of values) {
    acc = acc.add(dec(v))
  }
  return acc
}

function toNumber(value: string | number | Decimal | null | undefined): number {
  return dec(value).toNumber()
}

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function getCloseOrThrow(circleId: string, closeId: string) {
  const close = await prisma.yearEndClose.findFirst({ where: { id: closeId, circleId } })
  if (!close) throw new Error("Year-end close not found")
  return close
}

const LOCKED_STATUSES: YearEndCloseStatus[] = ["APPROVED", "FINALIZED"]

export async function getYearEndConfig(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const config = await prisma.yearEndCloseConfig.findUnique({ where: { circleId } })
  if (config) return config
  return {
    id: null,
    circleId,
    fiscalYearEndMonth: 12,
    fiscalYearEndDay: 31,
    autoNotifyMembers: true,
    requireApproval: true,
    createdById: null,
    createdAt: null,
    updatedAt: null,
  } as const
}

export async function upsertYearEndConfig(
  circleId: string,
  userId: string,
  data: { fiscalYearEndMonth?: number; fiscalYearEndDay?: number; autoNotifyMembers?: boolean; requireApproval?: boolean }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })
  const config = await prisma.yearEndCloseConfig.upsert({
    where: { circleId },
    update: {
      ...(data.fiscalYearEndMonth != null ? { fiscalYearEndMonth: data.fiscalYearEndMonth } : {}),
      ...(data.fiscalYearEndDay != null ? { fiscalYearEndDay: data.fiscalYearEndDay } : {}),
      ...(data.autoNotifyMembers != null ? { autoNotifyMembers: data.autoNotifyMembers } : {}),
      ...(data.requireApproval != null ? { requireApproval: data.requireApproval } : {}),
    },
    create: {
      circleId,
      createdById: userId,
      fiscalYearEndMonth: data.fiscalYearEndMonth ?? 12,
      fiscalYearEndDay: data.fiscalYearEndDay ?? 31,
      autoNotifyMembers: data.autoNotifyMembers ?? true,
      requireApproval: data.requireApproval ?? true,
    },
  })
  createAuditLog({ userId, circleId, action: "YEAR_END_CONFIG_UPDATED", entityType: "YearEndCloseConfig", entityId: config.id, newValues: data as Record<string, unknown> }).catch(() => {})
  return config
}

export interface InitiateYearEndInput {
  periodStart?: string
  periodEnd?: string
}

export async function initiateYearEndClose(circleId: string, userId: string, input: InitiateYearEndInput = {}) {
  await validateMember(circleId, userId)
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })

  const config = await prisma.yearEndCloseConfig.findUnique({ where: { circleId } })
  let periodStart: Date
  let periodEnd: Date
  if (input.periodStart || input.periodEnd) {
    periodStart = new Date(input.periodStart ?? new Date(0))
    periodEnd = new Date(input.periodEnd ?? new Date())
  } else {
    const now = new Date()
    periodEnd = new Date(now.getFullYear(), (config?.fiscalYearEndMonth ?? 12) - 1, config?.fiscalYearEndDay ?? 31, 23, 59, 59)
    if (periodEnd > now) {
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    }
    periodStart = new Date(periodEnd.getFullYear() - 1, (config?.fiscalYearEndMonth ?? 12) - 1, (config?.fiscalYearEndDay ?? 31) + 1, 0, 0, 0)
    if (periodStart > new Date(periodEnd.getFullYear() - 1, 0, 1)) {
      periodStart = new Date(periodEnd.getFullYear() - 1, (config?.fiscalYearEndMonth ?? 12) - 1, 1, 0, 0, 0)
    }
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.yearEndClose.findUnique({
      where: { circleId_periodEnd: { circleId, periodEnd } },
    })
    if (existing) {
      if (LOCKED_STATUSES.includes(existing.status)) {
        throw new Error("This period has already been closed and locked")
      }
      return existing
    }

    const close = await tx.yearEndClose.create({
      data: {
        circleId,
        periodStart,
        periodEnd,
        status: "DRAFT",
        createdById: userId,
      },
    })

    createAuditLog({ userId, circleId, action: "YEAR_END_INITIATED", entityType: "YearEndClose", entityId: close.id, newValues: { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() } }).catch(() => {})
    return close
  })
}

// ─── Blockers ─────────────────────────────────────────────

export interface Blocker {
  code: string
  severity: "ERROR" | "WARNING"
  message: string
  count?: number
}

interface BlockersResult {
  blockers: Blocker[]
  clear: boolean
  totals: {
    outstandingContributions: Decimal
    unpaidPayouts: Decimal
    unreconciledCount: number
  }
}

export async function detectBlockers(circleId: string, periodStart: Date, periodEnd: Date): Promise<BlockersResult> {
  const [members, contributions, payouts, pendingApprovals, contributionProofs, expenses] = await Promise.all([
    prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } }),
    prisma.contribution.findMany({
      where: {
        circleId,
        deletedAt: null,
        paymentDate: { lte: periodEnd },
        status: { in: ["DUE", "OVERDUE", "PENDING", "UPCOMING"] },
      },
      select: { amount: true, lateFeeAmount: true },
    }),
    prisma.payoutCycle.findMany({
      where: {
        circleId,
        createdAt: { lte: periodEnd },
        status: { in: ["READY", "PENDING_APPROVAL", "APPROVED", "PAID", "BLOCKED"] },
        NOT: { completionStatus: { in: ["PAID", "COMPLETED"] } },
      },
      select: { amount: true, status: true },
    }),
    prisma.approvalRequest.findMany({
      where: { circleId, status: "PENDING" },
      select: { id: true },
    }),
    prisma.contribution.findMany({
      where: {
        circleId,
        deletedAt: null,
        paymentDate: { lte: periodEnd },
        status: "PROOF_SUBMITTED",
        verificationStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
      select: { id: true },
    }),
    prisma.expense.findMany({
      where: { circleId, deletedAt: null, expenseDate: { lte: periodEnd } },
      select: { id: true, amount: true },
    }),
  ])

  const blockers: Blocker[] = []
  let outstanding = sumDecimal(contributions.map((c) => c.amount))
  const dueLateFees = sumDecimal(contributions.filter((c) => c.lateFeeAmount).map((c) => c.lateFeeAmount))

  if (contributions.length > 0) {
    blockers.push({
      code: "OUTSTANDING_CONTRIBUTIONS",
      severity: "ERROR",
      message: `${contributions.length} outstanding contribution(s) must be resolved before closing`,
      count: contributions.length,
    })
  }

  const unpaidPayouts = sumDecimal(payouts.map((p) => p.amount))
  if (payouts.length > 0) {
    blockers.push({
      code: "UNCONFIRMED_PAYOUTS",
      severity: "ERROR",
      message: `${payouts.length} payout(s) are not paid/confirmed for the period`,
      count: payouts.length,
    })
  }

  if (pendingApprovals.length > 0) {
    blockers.push({
      code: "PENDING_APPROVALS",
      severity: "ERROR",
      message: `${pendingApprovals.length} approval request(s) are still pending`,
      count: pendingApprovals.length,
    })
  }

  if (contributionProofs.length > 0) {
    blockers.push({
      code: "UNRESOLVED_PROOFS",
      severity: "WARNING",
      message: `${contributionProofs.length} contribution proof(s) are unresolved`,
      count: contributionProofs.length,
    })
  }

  // Reconciliation: total inflows (confirmed contributions + confirmed settlements received)
  // vs total outflows (expenses + paid payouts + late fees). Flag material imbalances.
  const confirmedContributions = await prisma.contribution.aggregate({
    where: {
      circleId,
      deletedAt: null,
      paymentDate: { lte: periodEnd },
      status: { in: [...CONFIRMED_CONTRIBUTION_STATUSES] },
    },
    _sum: { amount: true },
  })
  const grossIn = dec(confirmedContributions._sum.amount)
  const grossOut = sumDecimal(expenses.map((e) => e.amount)).add(dueLateFees)
  const net = grossIn.sub(grossOut)

  const unreconciledCount = 0
  const tolerance = new Prisma.Decimal(0.01)
  if (net.lt(new Prisma.Decimal(0).sub(tolerance))) {
    blockers.push({
      code: "UNRECONCILED_BALANCE",
      severity: "WARNING",
      message: `Reconciliation shows a net deficit of ${net.toFixed(2)} for the period`,
    })
  }

  return {
    blockers,
    clear: blockers.every((b) => b.severity === "WARNING"),
    totals: {
      outstandingContributions: outstanding,
      unpaidPayouts,
      unreconciledCount,
    },
  }
}

// ─── Reconciliation / Member figures ──────────────────────

export interface MemberYearEndFigures {
  userId: string
  totalContributed: Decimal
  outstandingContributions: Decimal
  penaltiesFees: Decimal
  payoutsReceived: Decimal
  allocatedReturns: Decimal
  finalEntitlement: Decimal
}

async function computeMemberFigures(
  circleId: string,
  periodStart: Date,
  periodEnd: Date,
  memberIds: string[]
): Promise<MemberYearEndFigures[]> {
  const [contributions, payouts, investmentReturns] = await Promise.all([
    prisma.contribution.findMany({
      where: {
        circleId,
        deletedAt: null,
        paymentDate: { gte: periodStart, lte: periodEnd },
        status: { in: [...CONFIRMED_CONTRIBUTION_STATUSES] },
      },
      select: { userId: true, amount: true, lateFeeApplied: true, lateFeeAmount: true },
    }),
    prisma.payoutCycle.findMany({
      where: {
        circleId,
        paidAt: { gte: periodStart, lte: periodEnd },
        status: { in: [...PAID_PAYOUT_STATUSES] },
      },
      select: { recipientId: true, amount: true },
    }),
    prisma.investmentReturn.findMany({
      where: { circleId, returnDate: { gte: periodStart, lte: periodEnd } },
      select: { amount: true },
    }),
  ])

  const map = new Map<string, MemberYearEndFigures>()
  for (const id of memberIds) {
    map.set(id, {
      userId: id,
      totalContributed: new Prisma.Decimal(0),
      outstandingContributions: new Prisma.Decimal(0),
      penaltiesFees: new Prisma.Decimal(0),
      payoutsReceived: new Prisma.Decimal(0),
      allocatedReturns: new Prisma.Decimal(0),
      finalEntitlement: new Prisma.Decimal(0),
    })
  }

  for (const c of contributions) {
    const fig = map.get(c.userId)
    if (!fig) continue
    fig.totalContributed = fig.totalContributed.add(dec(c.amount))
    if (c.lateFeeApplied && c.lateFeeAmount) {
      fig.penaltiesFees = fig.penaltiesFees.add(dec(c.lateFeeAmount))
    }
  }

  for (const p of payouts) {
    const fig = map.get(p.recipientId)
    if (!fig) continue
    fig.payoutsReceived = fig.payoutsReceived.add(dec(p.amount))
  }

  const totalReturns = sumDecimal(investmentReturns.map((r) => r.amount))
  if (totalReturns.gt(0) && memberIds.length > 0) {
    const share = totalReturns.div(memberIds.length)
    for (const id of memberIds) {
      const fig = map.get(id)!
      fig.allocatedReturns = fig.allocatedReturns.add(share)
    }
  }

  // Outstanding contributions for the member (due/overdue within the period).
  const [outstandingForPeriod, memberLateFees] = await Promise.all([
    prisma.contribution.findMany({
      where: {
        circleId,
        deletedAt: null,
        userId: { in: memberIds },
        paymentDate: { gte: periodStart, lte: periodEnd },
        status: { in: [...OUTSTANDING_CONTRIBUTION_STATUSES] },
      },
      select: { userId: true, amount: true },
    }),
    prisma.contribution.findMany({
      where: {
        circleId,
        deletedAt: null,
        userId: { in: memberIds },
        paymentDate: { gte: periodStart, lte: periodEnd },
        lateFeeApplied: true,
        lateFeeAmount: { not: null },
      },
      select: { userId: true, lateFeeAmount: true },
    }),
  ])

  for (const c of outstandingForPeriod) {
    const fig = map.get(c.userId)
    if (fig) fig.outstandingContributions = fig.outstandingContributions.add(dec(c.amount))
  }
  for (const c of memberLateFees) {
    const fig = map.get(c.userId)
    if (fig && c.lateFeeAmount) fig.penaltiesFees = fig.penaltiesFees.add(dec(c.lateFeeAmount))
  }

  for (const fig of map.values()) {
    fig.finalEntitlement = fig.totalContributed
      .sub(fig.outstandingContributions)
      .sub(fig.penaltiesFees)
      .add(fig.payoutsReceived)
      .add(fig.allocatedReturns)
  }

  return Array.from(map.values())
}

export interface ReconcileResult {
  close: Prisma.YearEndCloseGetPayload<{}> | null
  status: string
  memberFigures: MemberYearEndFigures[]
  groupSummary: {
    totalContributions: string
    totalOutstanding: string
    totalFees: string
    totalPayouts: string
    totalReturns: string
    totalEntitlement: string
    memberCount: number
  }
  blockers: Blocker[]
  clear: boolean
}

export async function reconcileYearEnd(circleId: string, closeId: string, userId: string): Promise<ReconcileResult> {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })
  const close = await getCloseOrThrow(circleId, closeId)
  if (LOCKED_STATUSES.includes(close.status)) throw new Error("Close is already locked")
  if (close.status === "FINALIZED") throw new Error("Finalized close cannot be reconciled")

  const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
  const memberFigures = await computeMemberFigures(circleId, close.periodStart, close.periodEnd, members.map((m) => m.userId))
  const block = await detectBlockers(circleId, close.periodStart, close.periodEnd)

  const groupSummary = {
    totalContributions: sumDecimal(memberFigures.map((f) => f.totalContributed)).toFixed(2),
    totalOutstanding: sumDecimal(memberFigures.map((f) => f.outstandingContributions)).toFixed(2),
    totalFees: sumDecimal(memberFigures.map((f) => f.penaltiesFees)).toFixed(2),
    totalPayouts: sumDecimal(memberFigures.map((f) => f.payoutsReceived)).toFixed(2),
    totalReturns: sumDecimal(memberFigures.map((f) => f.allocatedReturns)).toFixed(2),
    totalEntitlement: sumDecimal(memberFigures.map((f) => f.finalEntitlement)).toFixed(2),
    memberCount: memberFigures.length,
  }

  const summary = {
    period: { from: close.periodStart.toISOString(), to: close.periodEnd.toISOString() },
    group: groupSummary,
    members: memberFigures.map((f) => ({
      userId: f.userId,
      totalContributed: f.totalContributed.toFixed(2),
      outstandingContributions: f.outstandingContributions.toFixed(2),
      penaltiesFees: f.penaltiesFees.toFixed(2),
      payoutsReceived: f.payoutsReceived.toFixed(2),
      allocatedReturns: f.allocatedReturns.toFixed(2),
      finalEntitlement: f.finalEntitlement.toFixed(2),
    })),
  }

  const updated = await prisma.yearEndClose.update({
    where: { id: closeId },
    data: {
      status: "RECONCILING",
      summary: summary as unknown as Prisma.InputJsonValue,
      blockers: block
        ? ({ blockers: block.blockers, clear: block.clear } as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  })

  createAuditLog({ userId, circleId, action: "YEAR_END_RECONCILED", entityType: "YearEndClose", entityId: closeId }).catch(() => {})

  return {
    close: updated,
    status: "RECONCILING",
    memberFigures,
    groupSummary,
    blockers: block.blockers,
    clear: block.clear,
  }
}

// ─── Approval flow ─────────────────────────────────────────

export async function submitYearEndForApproval(circleId: string, closeId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })
  const close = await getCloseOrThrow(circleId, closeId)
  if (LOCKED_STATUSES.includes(close.status)) throw new Error("Close is already locked")
  if (close.status === "FINALIZED") throw new Error("Finalized close cannot be resubmitted")

  const config = await prisma.yearEndCloseConfig.findUnique({ where: { circleId } })
  const requireApproval = config?.requireApproval ?? true

  // Detect blockers: do not allow submission while hard errors exist.
  const block = await detectBlockers(circleId, close.periodStart, close.periodEnd)
  if (!block.clear) {
    throw new Error("Close cannot be submitted for approval until blockers are resolved")
  }

  const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
  const memberFigures = await computeMemberFigures(circleId, close.periodStart, close.periodEnd, members.map((m) => m.userId))
  const summary = {
    period: { from: close.periodStart.toISOString(), to: close.periodEnd.toISOString() },
    group: {
      totalContributions: sumDecimal(memberFigures.map((f) => f.totalContributed)).toFixed(2),
      totalOutstanding: sumDecimal(memberFigures.map((f) => f.outstandingContributions)).toFixed(2),
      totalFees: sumDecimal(memberFigures.map((f) => f.penaltiesFees)).toFixed(2),
      totalPayouts: sumDecimal(memberFigures.map((f) => f.payoutsReceived)).toFixed(2),
      totalReturns: sumDecimal(memberFigures.map((f) => f.allocatedReturns)).toFixed(2),
      totalEntitlement: sumDecimal(memberFigures.map((f) => f.finalEntitlement)).toFixed(2),
      memberCount: memberFigures.length,
    },
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.yearEndClose.update({
      where: { id: closeId },
      data: {
        status: "PENDING_APPROVAL",
        summary: summary as unknown as Prisma.InputJsonValue,
        blockers: { blockers: block.blockers, clear: block.clear } as unknown as Prisma.InputJsonValue,
      },
    })

    let approvalRequestId: string | null = close.approvalRequestId
    if (requireApproval) {
      const req = await createApprovalRequest({
        circleId,
        type: "SETTLEMENT",
        resourceId: closeId,
        title: `Year-end close approval for period ending ${close.periodEnd.toISOString().split("T")[0]}`,
        requestedById: userId,
        amount: toNumber(sumDecimal(memberFigures.map((f) => f.totalContributed))),
        currency: (await tx.circle.findUniqueOrThrow({ where: { id: circleId }, select: { currency: true } })).currency,
        metadata: { periodStart: close.periodStart.toISOString(), periodEnd: close.periodEnd.toISOString(), yearEndCloseId: closeId },
      })
      approvalRequestId = req.id
      await tx.yearEndClose.update({ where: { id: closeId }, data: { approvalRequestId: req.id } })
    }

    createAuditLog({ userId, circleId, action: "YEAR_END_SUBMITTED_FOR_APPROVAL", entityType: "YearEndClose", entityId: closeId, newValues: { requireApproval, approvalRequestId } }).catch(() => {})

    notifyCircleMembers(circleId, userId, {
      type: "YEAR_END_APPROVAL_REQUIRED",
      title: "Year-end close awaiting approval",
      message: `Review the year-end close for the period ending ${close.periodEnd.toISOString().split("T")[0]}.`,
      link: `/circles/${circleId}/year-end`,
    }).catch(() => {})

    return updated
  })
}

export async function approveYearEndClose(circleId: string, closeId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_APPROVE })
  const close = await getCloseOrThrow(circleId, closeId)
  if (close.status !== "PENDING_APPROVAL") throw new Error(`Cannot approve close in status ${close.status}`)

  return prisma.$transaction(async (tx) => {
    const config = await tx.yearEndCloseConfig.findUnique({ where: { circleId } })
    const requireApproval = config?.requireApproval ?? true

    if (requireApproval && close.approvalRequestId) {
      const req = await tx.approvalRequest.findUnique({ where: { id: close.approvalRequestId } })
      if (req && req.status !== "APPROVED") {
        throw new Error("The linked approval request has not been approved yet")
      }
    }

    const updated = await tx.yearEndClose.update({
      where: { id: closeId },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    })

    // Cancel any leftover pending approval request to avoid stale approvals.
    if (close.approvalRequestId) {
      await tx.approvalRequest.updateMany({
        where: { id: close.approvalRequestId, status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
    }

    createAuditLog({ userId, circleId, action: "YEAR_END_APPROVED", entityType: "YearEndClose", entityId: closeId }).catch(() => {})

    notifyCircleMembers(circleId, userId, {
      type: "YEAR_END_FINALIZED",
      title: "Year-end close approved",
      message: "The year-end close has been approved and is ready to be finalized.",
      link: `/circles/${circleId}/year-end`,
    }).catch(() => {})

    return updated
  })
}

// ─── Finalization / locking ────────────────────────────────

function formatStatementNumber(circleId: string, periodEnd: Date, userId: string): string {
  const y = periodEnd.getUTCFullYear()
  const mm = String(periodEnd.getUTCMonth() + 1).padStart(2, "0")
  return `YE-${y}${mm}-${circleId.slice(-4).toUpperCase()}-${userId.slice(-6).toUpperCase()}`
}

export async function finalizeYearEnd(circleId: string, closeId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })
  const close = await getCloseOrThrow(circleId, closeId)
  if (close.status === "FINALIZED") throw new Error("This year-end close is already finalized")

  return prisma.$transaction(async (tx) => {
    const config = await tx.yearEndCloseConfig.findUnique({ where: { circleId } })
    const requireApproval = config?.requireApproval ?? true
    const current = close.status

    if (requireApproval && current !== "APPROVED") {
      throw new Error(`Year-end close must be approved before finalization (status: ${current})`)
    }
    if (!requireApproval && current !== "PENDING_APPROVAL" && current !== "APPROVED") {
      throw new Error(`Year-end close must be reconciled before finalization (status: ${current})`)
    }

    // Re-detect blockers; hard errors block finalization.
    const block = await detectBlockers(circleId, close.periodStart, close.periodEnd)
    if (!block.clear) {
      const codes = block.blockers.map((b) => b.code).join(", ")
      throw new Error(`Blockers prevent finalization: ${codes}`)
    }

    const members = await tx.circleMember.findMany({ where: { circleId }, select: { userId: true } })
    const memberFigures = await computeMemberFigures(circleId, close.periodStart, close.periodEnd, members.map((m) => m.userId))

    const groupSummary = {
      totalContributions: sumDecimal(memberFigures.map((f) => f.totalContributed)).toFixed(2),
      totalOutstanding: sumDecimal(memberFigures.map((f) => f.outstandingContributions)).toFixed(2),
      totalFees: sumDecimal(memberFigures.map((f) => f.penaltiesFees)).toFixed(2),
      totalPayouts: sumDecimal(memberFigures.map((f) => f.payoutsReceived)).toFixed(2),
      totalReturns: sumDecimal(memberFigures.map((f) => f.allocatedReturns)).toFixed(2),
      totalEntitlement: sumDecimal(memberFigures.map((f) => f.finalEntitlement)).toFixed(2),
      memberCount: memberFigures.length,
    }

    // Mark previous member statements as no longer current, then snapshot new ones.
    await tx.yearEndMemberStatement.updateMany({
      where: { circleId, isCurrent: true },
      data: { isCurrent: false },
    })

    const statementNumbers: string[] = []
    for (const fig of memberFigures) {
      const statementNumber = formatStatementNumber(circleId, close.periodEnd, fig.userId)
      statementNumbers.push(statementNumber)
      await tx.yearEndMemberStatement.create({
        data: {
          closeId,
          circleId,
          userId: fig.userId,
          statementNumber,
          periodStart: close.periodStart,
          periodEnd: close.periodEnd,
          totalContributed: fig.totalContributed,
          outstandingContributions: fig.outstandingContributions,
          penaltiesFees: fig.penaltiesFees,
          payoutsReceived: fig.payoutsReceived,
          allocatedReturns: fig.allocatedReturns,
          finalEntitlement: fig.finalEntitlement,
          snapshot: {
            group: groupSummary,
            memberId: fig.userId,
          } as unknown as Prisma.InputJsonValue,
          isCurrent: true,
        },
      })
      createAuditLog({ userId, circleId, action: "YEAR_END_STATEMENT_CREATED", entityType: "YearEndMemberStatement", entityId: statementNumber, affectedUserId: fig.userId, newValues: { totalContributed: fig.totalContributed.toFixed(2), finalEntitlement: fig.finalEntitlement.toFixed(2) } }).catch(() => {})
    }

    const finalized = await tx.yearEndClose.update({
      where: { id: closeId },
      data: {
        status: "FINALIZED",
        finalizedById: userId,
        finalizedAt: new Date(),
        summary: {
          period: { from: close.periodStart.toISOString(), to: close.periodEnd.toISOString() },
          group: groupSummary,
          memberCount: memberFigures.length,
          statementsCreated: statementNumbers.length,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    // Cancel any leftover pending approval request.
    if (close.approvalRequestId) {
      await tx.approvalRequest.updateMany({
        where: { id: close.approvalRequestId, status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
    }

    createAuditLog({ userId, circleId, action: "YEAR_END_FINALIZED", entityType: "YearEndClose", entityId: closeId, newValues: { periodEnd: close.periodEnd.toISOString(), memberCount: memberFigures.length } }).catch(() => {})

    const configAutoNotify = config?.autoNotifyMembers ?? true
    if (configAutoNotify) {
      notifyCircleMembers(circleId, userId, {
        type: "YEAR_END_FINALIZED",
        title: "Year-end close finalized",
        message: `The financial year ending ${close.periodEnd.toISOString().split("T")[0]} has been closed. Statements are available.`,
        link: `/circles/${circleId}/year-end`,
      }).catch(() => {})
    }

    return finalized
  })
}

// ─── Read APIs ────────────────────────────────────────────

export async function listYearEndCloses(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const closes = await prisma.yearEndClose.findMany({
    where: { circleId },
    orderBy: { periodEnd: "desc" },
  })
  return {
    closes: closes.map((c) => ({
      id: c.id,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      status: c.status,
      summary: c.summary,
      blockers: c.blockers,
      approvedById: c.approvedById,
      approvedAt: c.approvedAt,
      finalizedById: c.finalizedById,
      finalizedAt: c.finalizedAt,
      createdAt: c.createdAt,
    })),
  }
}

export async function getYearEndClose(circleId: string, closeId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const close = await getCloseOrThrow(circleId, closeId)
  return {
    id: close.id,
    periodStart: close.periodStart,
    periodEnd: close.periodEnd,
    status: close.status,
    summary: close.summary,
    blockers: close.blockers,
    corrections: close.corrections,
    approvedById: close.approvedById,
    approvedAt: close.approvedAt,
    finalizedById: close.finalizedById,
    finalizedAt: close.finalizedAt,
    openedById: close.openedById,
    openedAt: close.openedAt,
    createdAt: close.createdAt,
  }
}

interface MemberStatementView {
  statementNumber: string
  periodStart: string
  periodEnd: string
  totalContributed: string
  outstandingContributions: string
  penaltiesFees: string
  payoutsReceived: string
  allocatedReturns: string
  finalEntitlement: string
  snapshot: Prisma.JsonValue | null
  finalizedAt: Date | null
  circleName: string | null
}

const MEMBER_STATEMENT_SELECT = {
  statementNumber: true,
  periodStart: true,
  periodEnd: true,
  totalContributed: true,
  outstandingContributions: true,
  penaltiesFees: true,
  payoutsReceived: true,
  allocatedReturns: true,
  finalEntitlement: true,
  snapshot: true,
  close: { select: { finalizedAt: true } },
  circle: { select: { name: true } },
} as const

function mapStatement(s: {
  statementNumber: string
  periodStart: Date
  periodEnd: Date
  totalContributed: string | number | Decimal
  outstandingContributions: string | number | Decimal
  penaltiesFees: string | number | Decimal
  payoutsReceived: string | number | Decimal
  allocatedReturns: string | number | Decimal
  finalEntitlement: string | number | Decimal
  snapshot: Prisma.JsonValue | null
  close: { finalizedAt: Date | null }
  circle: { name: string | null }
}): MemberStatementView {
  return {
    statementNumber: s.statementNumber,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    totalContributed: dec(s.totalContributed).toFixed(2),
    outstandingContributions: dec(s.outstandingContributions).toFixed(2),
    penaltiesFees: dec(s.penaltiesFees).toFixed(2),
    payoutsReceived: dec(s.payoutsReceived).toFixed(2),
    allocatedReturns: dec(s.allocatedReturns).toFixed(2),
    finalEntitlement: dec(s.finalEntitlement).toFixed(2),
    snapshot: s.snapshot,
    finalizedAt: s.close?.finalizedAt ?? null,
    circleName: s.circle?.name ?? null,
  }
}

// Member can only view their own statement. This is the privacy-critical API.
export async function getMemberStatement(circleId: string, userId: string, opts: { periodEnd?: string; closeId?: string } = {}) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })

  const where: Record<string, unknown> = {
    circleId,
    userId,
    isCurrent: opts.periodEnd ? undefined : true,
    ...(opts.closeId ? { closeId: opts.closeId } : {}),
    ...(opts.periodEnd ? { periodEnd: new Date(opts.periodEnd) } : {}),
  }
  if (opts.periodEnd) delete where.isCurrent

  const statement = await prisma.yearEndMemberStatement.findFirst({
    where: where as Prisma.YearEndMemberStatementWhereInput,
    select: MEMBER_STATEMENT_SELECT,
    orderBy: { periodEnd: "desc" },
  })

  if (!statement) return null
  return mapStatement(statement)
}

export async function getMemberStatements(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const statements = await prisma.yearEndMemberStatement.findMany({
    where: { circleId, userId },
    select: MEMBER_STATEMENT_SELECT,
    orderBy: { periodEnd: "desc" },
  })
  return statements.map(mapStatement)
}

// Authorized users (admins/treasurers with YEAR_END_VIEW) can view any member's statement.
export async function getCircleStatements(
  circleId: string,
  userId: string,
  opts: { memberUserId?: string; closeId?: string } = {}
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const isViewer = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })
    || await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_VIEW })

  // Members without elevated rights can only ever see their own statement.
  const where: Prisma.YearEndMemberStatementWhereInput = {
    circleId,
    ...(opts.closeId ? { closeId: opts.closeId } : {}),
  }
  if (!isViewer) {
    where.userId = userId
  } else if (opts.memberUserId) {
    where.userId = opts.memberUserId
  }

  const statements = await prisma.yearEndMemberStatement.findMany({
    where,
    select: MEMBER_STATEMENT_SELECT,
    orderBy: { periodEnd: "desc" },
  })
  return statements.map(mapStatement)
}

// ─── Reconciliation / Contribution summary reports ────────

export async function getPayoutReconciliationReport(circleId: string, userId: string, closeId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const close = await getCloseOrThrow(circleId, closeId)

  const payouts = await prisma.payoutCycle.findMany({
    where: { circleId, createdAt: { gte: close.periodStart, lte: close.periodEnd } },
    include: { recipient: { select: { id: true, name: true } } },
    orderBy: { cycleNumber: "asc" },
  })

  return {
    totalPayouts: payouts.length,
    paid: payouts.filter((p) => PAID_PAYOUT_STATUSES.includes(p.status as (typeof PAID_PAYOUT_STATUSES)[number])).length,
    outstanding: payouts.filter((p) => !PAID_PAYOUT_STATUSES.includes(p.status as (typeof PAID_PAYOUT_STATUSES)[number])).length,
    cycles: payouts.map((p) => ({
      cycleNumber: p.cycleNumber,
      recipient: p.recipient.name,
      amount: dec(p.amount).toFixed(2),
      status: p.status,
      completionStatus: p.completionStatus,
      paidAt: p.paidAt,
      confirmedAt: p.confirmedAt,
    })),
  }
}

export async function getContributionSummary(circleId: string, userId: string, closeId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })
  const close = await getCloseOrThrow(circleId, closeId)

  const [confirmed, outstanding, lateFees, members] = await Promise.all([
    prisma.contribution.aggregate({
      where: {
        circleId,
        deletedAt: null,
        paymentDate: { gte: close.periodStart, lte: close.periodEnd },
        status: { in: [...CONFIRMED_CONTRIBUTION_STATUSES] },
      },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.contribution.aggregate({
      where: {
        circleId,
        deletedAt: null,
        paymentDate: { gte: close.periodStart, lte: close.periodEnd },
        status: { in: [...OUTSTANDING_CONTRIBUTION_STATUSES] },
      },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.contribution.aggregate({
      where: {
        circleId,
        deletedAt: null,
        paymentDate: { gte: close.periodStart, lte: close.periodEnd },
        lateFeeApplied: true,
      },
      _count: true,
      _sum: { lateFeeAmount: true },
    }),
    prisma.circleMember.count({ where: { circleId } }),
  ])

  return {
    members,
    confirmed: { count: confirmed._count, total: dec(confirmed._sum.amount).toFixed(2) },
    outstanding: { count: outstanding._count, total: dec(outstanding._sum.amount).toFixed(2) },
    lateFees: { count: lateFees._count, total: dec(lateFees._sum.lateFeeAmount).toFixed(2) },
    period: { from: close.periodStart.toISOString(), to: close.periodEnd.toISOString() },
  }
}

// ─── Audited adjustments / reopening ──────────────────────

export async function recordAdjustment(
  circleId: string,
  closeId: string,
  userId: string,
  data: { userId: string; type: string; reason: string; beforeValue?: Record<string, unknown>; afterValue?: Record<string, unknown> }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_ADJUST })
  const close = await getCloseOrThrow(circleId, closeId)
  if (close.status === "FINALIZED") throw new Error("Finalized close is locked; reopen it before recording corrections")

  const adjustment = await prisma.yearEndAdjustment.create({
    data: {
      closeId,
      circleId,
      userId: data.userId,
      createdById: userId,
      type: data.type,
      reason: data.reason,
      beforeValue: data.beforeValue as Prisma.InputJsonValue | undefined,
      afterValue: data.afterValue as Prisma.InputJsonValue | undefined,
    },
  })

  // Track corrections on the close (non-destructive; historical figures untouched).
  await prisma.yearEndClose.update({
    where: { id: closeId },
    data: {
      corrections: [
        ...((close.corrections as unknown as unknown[]) ?? []),
        {
          adjustmentId: adjustment.id,
          userId: data.userId,
          type: data.type,
          reason: data.reason,
          beforeValue: data.beforeValue,
          afterValue: data.afterValue,
          createdAt: new Date().toISOString(),
        },
      ] as unknown as Prisma.InputJsonValue,
    },
  })

  createAuditLog({ userId, circleId, action: "YEAR_END_ADJUSTMENT_RECORDED", entityType: "YearEndAdjustment", entityId: adjustment.id, affectedUserId: data.userId, newValues: { type: data.type, reason: data.reason } }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "YEAR_END_ADJUSTMENT_RECORDED",
    title: "Year-end adjustment recorded",
    message: `An audited adjustment (${data.type}) was recorded on the year-end close.`,
    link: `/circles/${circleId}/year-end`,
  }).catch(() => {})

  return adjustment
}

export async function reopenYearEnd(circleId: string, closeId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_ADJUST })
  const close = await getCloseOrThrow(circleId, closeId)
  if (close.status !== "FINALIZED") throw new Error("Only finalized closes can be reopened")

  const updated = await prisma.yearEndClose.update({
    where: { id: closeId },
    data: { status: "REOPENED", openedById: userId, openedAt: new Date() },
  })

  createAuditLog({ userId, circleId, action: "YEAR_END_REOPENED", entityType: "YearEndClose", entityId: closeId, reason: "Audited reopen for corrections" }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "YEAR_END_REOPENED",
    title: "Year-end close reopened",
    message: "A finalized year-end close was reopened for audited corrections.",
    link: `/circles/${circleId}/year-end`,
  }).catch(() => {})

  return updated
}

// ─── Dashboard status ─────────────────────────────────────

export async function getYearEndDashboardStatus(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW })

  const [latest, statements, memberCurrent] = await Promise.all([
    prisma.yearEndClose.findFirst({
      where: { circleId },
      orderBy: { periodEnd: "desc" },
    }),
    prisma.yearEndMemberStatement.count({ where: { circleId } }),
    prisma.yearEndMemberStatement.findFirst({
      where: { circleId, userId, isCurrent: true },
      select: MEMBER_STATEMENT_SELECT,
    }),
  ])

  const stepOrder = ["DRAFT", "RECONCILING", "PENDING_APPROVAL", "APPROVED", "FINALIZED"] as const

  return {
    hasClose: !!latest,
    status: latest?.status ?? null,
    statusIndex: latest ? stepOrder.indexOf(latest.status as (typeof stepOrder)[number]) : -1,
    totalSteps: stepOrder.length,
    periodStart: latest?.periodStart ?? null,
    periodEnd: latest?.periodEnd ?? null,
    statementsGenerated: statements,
    myStatement: mapStatementSafe(memberCurrent),
    finalizedAt: latest?.finalizedAt ?? null,
    blockers: latest?.blockers ?? null,
  }
}

function mapStatementSafe(s: {
  statementNumber: string
  periodStart: Date
  periodEnd: Date
  totalContributed: string | number | Decimal
  outstandingContributions: string | number | Decimal
  penaltiesFees: string | number | Decimal
  payoutsReceived: string | number | Decimal
  allocatedReturns: string | number | Decimal
  finalEntitlement: string | number | Decimal
  snapshot: Prisma.JsonValue | null
  close: { finalizedAt: Date | null }
  circle: { name: string | null }
} | null): MemberStatementView | null {
  if (!s) return null
  return mapStatement(s)
}
