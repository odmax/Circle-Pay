import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification, notifyCircleMembers } from "@/lib/services/notification.service"
import { createApprovalRequest } from "@/lib/services/approval.service"

type Decimal = Prisma.Decimal

function dec(value: string | number | Decimal | null | undefined): Decimal {
  return new Prisma.Decimal(value ?? 0)
}

function toNumber(value: string | number | Decimal | null | undefined): number {
  return dec(value).toNumber()
}

const ACTIVE_LOAN_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "DISBURSED", "REPAYING", "OVERDUE"] as const

type LoanStatus = (typeof ACTIVE_LOAN_STATUSES)[number]

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function getLoanOrThrow(circleId: string, loanId: string) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, circleId }, include: { schedule: true } })
  if (!loan) throw new Error("Loan not found")
  return loan
}

// ─── Config ───────────────────────────────────────────────

export interface LoanConfigView {
  enabled: boolean
  minLoanAmount: string | null
  maxLoanAmount: string | null
  maxTotalLoansOutstanding: string | null
  maxActiveLoansPerMember: number | null
  interestRate: string
  serviceFeePercent: string
  maxRepaymentTermMonths: number | null
  defaultRepaymentFrequency: string
  gracePeriodDays: number | null
  lateFeePercent: string | null
  allowsMemberInitiated: boolean
  requiresApproval: boolean
  autoConfirmRepayments: boolean
}

const LOAN_CONFIG_DEFAULTS = {
  enabled: false,
  minLoanAmount: null,
  maxLoanAmount: null,
  maxTotalLoansOutstanding: null,
  maxActiveLoansPerMember: 1,
  interestRate: new Prisma.Decimal(0),
  serviceFeePercent: new Prisma.Decimal(0),
  maxRepaymentTermMonths: 12,
  defaultRepaymentFrequency: "MONTHLY" as const,
  gracePeriodDays: 7,
  lateFeePercent: new Prisma.Decimal(5),
  allowsMemberInitiated: true,
  requiresApproval: true,
  autoConfirmRepayments: false,
}

export async function getLoanConfig(circleId: string, userId: string): Promise<LoanConfigView> {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_OWN })
  const row = await prisma.circleLoanConfig.findUnique({ where: { circleId } })
  if (!row) {
    return {
      enabled: false,
      minLoanAmount: null,
      maxLoanAmount: null,
      maxTotalLoansOutstanding: null,
      maxActiveLoansPerMember: LOAN_CONFIG_DEFAULTS.maxActiveLoansPerMember,
      interestRate: LOAN_CONFIG_DEFAULTS.interestRate.toFixed(4),
      serviceFeePercent: LOAN_CONFIG_DEFAULTS.serviceFeePercent.toFixed(4),
      maxRepaymentTermMonths: LOAN_CONFIG_DEFAULTS.maxRepaymentTermMonths,
      defaultRepaymentFrequency: LOAN_CONFIG_DEFAULTS.defaultRepaymentFrequency,
      gracePeriodDays: LOAN_CONFIG_DEFAULTS.gracePeriodDays,
      lateFeePercent: LOAN_CONFIG_DEFAULTS.lateFeePercent.toFixed(4),
      allowsMemberInitiated: LOAN_CONFIG_DEFAULTS.allowsMemberInitiated,
      requiresApproval: LOAN_CONFIG_DEFAULTS.requiresApproval,
      autoConfirmRepayments: LOAN_CONFIG_DEFAULTS.autoConfirmRepayments,
    }
  }
  return {
    enabled: row.enabled,
    minLoanAmount: row.minLoanAmount ? dec(row.minLoanAmount).toFixed(2) : null,
    maxLoanAmount: row.maxLoanAmount ? dec(row.maxLoanAmount).toFixed(2) : null,
    maxTotalLoansOutstanding: row.maxTotalLoansOutstanding ? dec(row.maxTotalLoansOutstanding).toFixed(2) : null,
    maxActiveLoansPerMember: row.maxActiveLoansPerMember,
    interestRate: dec(row.interestRate).toFixed(4),
    serviceFeePercent: dec(row.serviceFeePercent).toFixed(4),
    maxRepaymentTermMonths: row.maxRepaymentTermMonths,
    defaultRepaymentFrequency: row.defaultRepaymentFrequency,
    gracePeriodDays: row.gracePeriodDays,
    lateFeePercent: row.lateFeePercent ? dec(row.lateFeePercent).toFixed(4) : null,
    allowsMemberInitiated: row.allowsMemberInitiated,
    requiresApproval: row.requiresApproval,
    autoConfirmRepayments: row.autoConfirmRepayments,
  }
}

export async function upsertLoanConfig(
  circleId: string,
  userId: string,
  data: {
    enabled?: boolean
    minLoanAmount?: number
    maxLoanAmount?: number
    maxTotalLoansOutstanding?: number
    maxActiveLoansPerMember?: number
    interestRate?: number
    serviceFeePercent?: number
    maxRepaymentTermMonths?: number
    defaultRepaymentFrequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY"
    gracePeriodDays?: number
    lateFeePercent?: number
    allowsMemberInitiated?: boolean
    requiresApproval?: boolean
    autoConfirmRepayments?: boolean
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_CONFIG_MANAGE })
  const dup = await prisma.circleLoanConfig.upsert({
    where: { circleId },
    update: {
      ...(data.enabled != null ? { enabled: data.enabled } : {}),
      ...(data.minLoanAmount != null ? { minLoanAmount: new Prisma.Decimal(data.minLoanAmount) } : {}),
      ...(data.maxLoanAmount != null ? { maxLoanAmount: new Prisma.Decimal(data.maxLoanAmount) } : {}),
      ...(data.maxTotalLoansOutstanding != null ? { maxTotalLoansOutstanding: new Prisma.Decimal(data.maxTotalLoansOutstanding) } : {}),
      ...(data.maxActiveLoansPerMember != null ? { maxActiveLoansPerMember: data.maxActiveLoansPerMember } : {}),
      ...(data.interestRate != null ? { interestRate: new Prisma.Decimal(data.interestRate) } : {}),
      ...(data.serviceFeePercent != null ? { serviceFeePercent: new Prisma.Decimal(data.serviceFeePercent) } : {}),
      ...(data.maxRepaymentTermMonths != null ? { maxRepaymentTermMonths: data.maxRepaymentTermMonths } : {}),
      ...(data.defaultRepaymentFrequency != null ? { defaultRepaymentFrequency: data.defaultRepaymentFrequency } : {}),
      ...(data.gracePeriodDays != null ? { gracePeriodDays: data.gracePeriodDays } : {}),
      ...(data.lateFeePercent != null ? { lateFeePercent: new Prisma.Decimal(data.lateFeePercent) } : {}),
      ...(data.allowsMemberInitiated != null ? { allowsMemberInitiated: data.allowsMemberInitiated } : {}),
      ...(data.requiresApproval != null ? { requiresApproval: data.requiresApproval } : {}),
      ...(data.autoConfirmRepayments != null ? { autoConfirmRepayments: data.autoConfirmRepayments } : {}),
    },
    create: {
      circleId,
      createdById: userId,
      enabled: data.enabled ?? false,
      minLoanAmount: data.minLoanAmount != null ? new Prisma.Decimal(data.minLoanAmount) : null,
      maxLoanAmount: data.maxLoanAmount != null ? new Prisma.Decimal(data.maxLoanAmount) : null,
      maxTotalLoansOutstanding: data.maxTotalLoansOutstanding != null ? new Prisma.Decimal(data.maxTotalLoansOutstanding) : null,
      maxActiveLoansPerMember: data.maxActiveLoansPerMember ?? 1,
      interestRate: data.interestRate != null ? new Prisma.Decimal(data.interestRate) : new Prisma.Decimal(0),
      serviceFeePercent: data.serviceFeePercent != null ? new Prisma.Decimal(data.serviceFeePercent) : new Prisma.Decimal(0),
      maxRepaymentTermMonths: data.maxRepaymentTermMonths ?? 12,
      defaultRepaymentFrequency: data.defaultRepaymentFrequency ?? "MONTHLY",
      gracePeriodDays: data.gracePeriodDays ?? 7,
      lateFeePercent: data.lateFeePercent != null ? new Prisma.Decimal(data.lateFeePercent) : new Prisma.Decimal(5),
      allowsMemberInitiated: data.allowsMemberInitiated ?? true,
      requiresApproval: data.requiresApproval ?? true,
      autoConfirmRepayments: data.autoConfirmRepayments ?? false,
    },
  })

  createAuditLog({ userId, circleId, action: "LOAN_CONFIG_UPDATED", entityType: "CircleLoanConfig", entityId: dup.id, newValues: data as Record<string, unknown> }).catch(() => {})
  return dup
}

// ─── Application ──────────────────────────────────────────

export interface ApplyLoanInput {
  principal: number
  termMonths: number
  purpose?: string
  repaymentFrequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY"
}

export async function applyForLoan(circleId: string, userId: string, input: ApplyLoanInput) {
  await validateMember(circleId, userId)
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_APPLY })

  const config = (await prisma.circleLoanConfig.findUnique({ where: { circleId } })) ?? null
  if (config && !config.enabled) throw new Error("Loans are not enabled for this circle")

  const principal = new Prisma.Decimal(input.principal)
  if (principal.lte(0)) throw new Error("Loan amount must be greater than zero")

  const maxAmount = config?.maxLoanAmount
  if (maxAmount && principal.gt(dec(maxAmount))) throw new Error(`Loan amount exceeds the maximum of ${dec(maxAmount).toFixed(2)}`)

  const minAmount = config?.minLoanAmount
  if (minAmount && principal.lt(dec(minAmount))) throw new Error(`Loan amount is below the minimum of ${dec(minAmount).toFixed(2)}`)

  const termMonths = input.termMonths
  const maxTerm = config?.maxRepaymentTermMonths ?? 12
  if (termMonths < 1) throw new Error("Loan term must be at least 1 month")
  if (termMonths > maxTerm) throw new Error(`Loan term cannot exceed ${maxTerm} months`)

  const maxActive = config?.maxActiveLoansPerMember ?? 1
  const activeCount = await prisma.loan.count({
    where: { circleId, memberId: userId, status: { in: [...ACTIVE_LOAN_STATUSES] } },
  })
  if (activeCount >= maxActive) throw new Error(`You already have the maximum active loans (${maxActive})`)

  const maxTotal = config?.maxTotalLoansOutstanding
  if (maxTotal) {
    const outstanding = await prisma.loan.aggregate({
      where: { circleId, status: { in: ["APPROVED", "DISBURSED", "REPAYING", "OVERDUE"] } },
      _sum: { principal: true },
    })
    const total = dec(outstanding._sum.principal).add(principal)
    if (total.gt(dec(maxTotal))) throw new Error(`Total outstanding loans would exceed the circle limit of ${dec(maxTotal).toFixed(2)}`)
  }

  const serviceFeePercent = config?.serviceFeePercent ?? new Prisma.Decimal(0)
  const serviceFee = principal.mul(dec(serviceFeePercent)).div(100)
  const interestRate = config?.interestRate ?? new Prisma.Decimal(0)

  const loan = await prisma.loan.create({
    data: {
      circleId,
      memberId: userId,
      principal,
      serviceFee,
      interestRate,
      termMonths,
      repaymentFrequency: input.repaymentFrequency ?? config?.defaultRepaymentFrequency ?? "MONTHLY",
      purpose: input.purpose ?? null,
      status: "DRAFT",
      requestedAt: new Date(),
    },
  })

  const submitted = await prisma.loan.update({
    where: { id: loan.id },
    data: { status: "SUBMITTED" },
  })

  createAuditLog({ userId, circleId, action: "LOAN_APPLIED", entityType: "Loan", entityId: loan.id, newValues: { principal: principal.toFixed(2), termMonths, frequency: submitted.repaymentFrequency } }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "LOAN_APPLIED",
    title: "New loan application",
    message: `A member has applied for a loan of ${principal.toFixed(2)}.`,
    link: `/circles/${circleId}/loans`,
  }).catch(() => {})

  return submitted
}

// ─── Approval (via existing Approval engine) ──────────────

export async function submitLoanForApproval(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REVIEW })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (!["SUBMITTED", "UNDER_REVIEW", "DRAFT"].includes(loan.status)) {
    throw new Error(`Cannot submit loan for approval in status ${loan.status}`)
  }

  const config = await prisma.circleLoanConfig.findUnique({ where: { circleId } })
  const requiresApproval = config?.requiresApproval ?? true
  const circle = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, select: { currency: true } })

  return prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: { status: "UNDER_REVIEW" },
    })

    let approvalRequestId: string | null = loan.approvalRequestId
    if (requiresApproval) {
      const req = await createApprovalRequest({
        circleId,
        type: "LOAN",
        resourceId: loanId,
        title: `Loan approval for ${loan.memberId} — ${dec(loan.principal).toFixed(2)}`,
        requestedById: userId,
        amount: toNumber(loan.principal),
        currency: circle.currency,
        metadata: { loanId, memberId: loan.memberId },
      })
      approvalRequestId = req.id
      await tx.loan.update({ where: { id: loanId }, data: { approvalRequestId: req.id } })
    }

    createAuditLog({ userId, circleId, action: "LOAN_SUBMITTED_FOR_APPROVAL", entityType: "Loan", entityId: loanId, newValues: { requiresApproval, approvalRequestId } }).catch(() => {})
    return approvalRequestId
  })
}

async function buildRepaymentSchedule(tx: Prisma.TransactionClient, loan: {
  id: string; circleId: string; principal: Decimal; interestRate: Decimal;
  termMonths: number; repaymentFrequency: string; repaymentStartDate: Date | null;
}) {
  const principal = dec(loan.principal)
  const rate = dec(loan.interestRate)
  const term = loan.termMonths
  const perPeriodInterest = principal.mul(rate)
  const principalPerPeriod = principal.div(term)

  const intervalMs = loan.repaymentFrequency === "WEEKLY" ? 7 * 24 * 3600 * 1000 : loan.repaymentFrequency === "QUARTERLY" ? 3 * 30 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000
  const start = new Date(loan.repaymentStartDate ?? new Date())

  const rows = []
  for (let i = 0; i < term; i++) {
    const due = new Date(start.getTime() + i * intervalMs)
    const isLast = i === term - 1
    const principalDue = isLast ? principal.sub(principalPerPeriod.mul(term - 1)) : principalPerPeriod
    const interestDue = perPeriodInterest
    const totalDue = principalDue.add(interestDue).toDecimalPlaces(2)
    rows.push({
      loanId: loan.id,
      circleId: loan.circleId,
      periodNumber: i + 1,
      dueDate: due,
      principalDue: principalDue.toDecimalPlaces(2),
      interestDue: interestDue.toDecimalPlaces(2),
      totalDue,
      amountPaid: new Prisma.Decimal(0),
      status: "PENDING" as const,
    })
  }
  await tx.loanRepaymentSchedule.createMany({ data: rows })
}

export async function approveLoan(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_APPROVE })
  const loan = await getLoanOrThrow(circleId, loanId)

  if (loan.memberId === userId) throw new Error("Members cannot approve their own loan")
  if (loan.status !== "UNDER_REVIEW") throw new Error(`Cannot approve loan in status ${loan.status}`)

  return prisma.$transaction(async (tx) => {
    const config = await tx.circleLoanConfig.findUnique({ where: { circleId } })
    const requiresApproval = config?.requiresApproval ?? true

    if (requiresApproval && loan.approvalRequestId) {
      const req = await tx.approvalRequest.findUnique({ where: { id: loan.approvalRequestId } })
      if (req && req.status !== "APPROVED") {
        throw new Error("The linked approval request has not been approved yet")
      }
    }

    const updated = await tx.loan.update({
      where: { id: loanId },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    })

    await buildRepaymentSchedule(tx, {
      id: loan.id,
      circleId,
      principal: dec(loan.principal),
      interestRate: dec(loan.interestRate),
      termMonths: loan.termMonths,
      repaymentFrequency: loan.repaymentFrequency,
      repaymentStartDate: loan.repaymentStartDate,
    })

    if (loan.approvalRequestId) {
      await tx.approvalRequest.updateMany({
        where: { id: loan.approvalRequestId, status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
    }

    createAuditLog({ userId, circleId, action: "LOAN_APPROVED", entityType: "Loan", entityId: loanId, affectedUserId: loan.memberId }).catch(() => {})

    createNotification({
      userId: loan.memberId,
      circleId,
      type: "LOAN_APPROVED",
      title: "Loan approved",
      message: `Your loan of ${dec(loan.principal).toFixed(2)} has been approved.`,
      link: `/circles/${circleId}/loans`,
    }).catch(() => {})

    return updated
  })
}

export async function rejectLoan(circleId: string, loanId: string, userId: string, reason?: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_APPROVE })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (!["SUBMITTED", "UNDER_REVIEW", "DRAFT"].includes(loan.status)) {
    throw new Error(`Cannot reject loan in status ${loan.status}`)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: { status: "REJECTED" },
    })

    if (loan.approvalRequestId) {
      await tx.approvalRequest.updateMany({
        where: { id: loan.approvalRequestId, status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
    }

    createAuditLog({ userId, circleId, action: "LOAN_REJECTED", entityType: "Loan", entityId: loanId, reason: reason ?? null }).catch(() => {})
    createNotification({
      userId: loan.memberId,
      circleId,
      type: "LOAN_REJECTED",
      title: "Loan application rejected",
      message: reason ?? "Your loan application was not approved.",
      link: `/circles/${circleId}/loans`,
    }).catch(() => {})

    return updated
  })
}

// ─── Disbursement ─────────────────────────────────────────

export async function recordDisbursement(
  circleId: string,
  loanId: string,
  userId: string,
  data: { amount?: number; method?: string; reference?: string; proofUrl?: string; proofReference?: string }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_DISBURSE })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (loan.status !== "APPROVED") throw new Error(`Loan must be approved before disbursement (status: ${loan.status})`)

  const amount = data.amount != null ? new Prisma.Decimal(data.amount) : dec(loan.principal)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const existing = await tx.loanDisbursement.findUnique({ where: { loanId } })
    const disbursement = existing
      ? await tx.loanDisbursement.update({
          where: { loanId },
          data: {
            amount,
            method: data.method ?? null,
            reference: data.reference ?? null,
            proofUrl: data.proofUrl ?? null,
            proofReference: data.proofReference ?? null,
            status: "PROOF_SUBMITTED",
          },
        })
      : await tx.loanDisbursement.create({
          data: {
            loanId,
            amount,
            method: data.method ?? null,
            reference: data.reference ?? null,
            proofUrl: data.proofUrl ?? null,
            proofReference: data.proofReference ?? null,
            status: "PROOF_SUBMITTED",
          },
        })

    await tx.loan.update({
      where: { id: loanId },
      data: { status: "DISBURSED", repaymentStartDate: now },
    })

    createAuditLog({ userId, circleId, action: "LOAN_DISBURSEMENT_RECORDED", entityType: "LoanDisbursement", entityId: disbursement.id, newValues: { amount: amount.toFixed(2), method: data.method, reference: data.reference } }).catch(() => {})
    return disbursement
  })
}

export async function confirmDisbursement(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_DISBURSE })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (loan.status !== "DISBURSED") throw new Error(`Loan must be disbursed before confirming (status: ${loan.status})`)

  return prisma.$transaction(async (tx) => {
    const disb = await tx.loanDisbursement.findUnique({ where: { loanId } })
    if (!disb) throw new Error("No disbursement proof recorded")

    await tx.loanDisbursement.update({
      where: { loanId },
      data: { status: "CONFIRMED", confirmedById: userId, confirmedAt: new Date() },
    })

    const updated = await tx.loan.update({
      where: { id: loanId },
      data: { status: "REPAYING", disbursedById: userId, disbursedAt: new Date() },
    })

    createAuditLog({ userId, circleId, action: "LOAN_DISBURSED", entityType: "Loan", entityId: loanId, newValues: { amount: dec(disb.amount).toFixed(2) } }).catch(() => {})
    createNotification({
      userId: loan.memberId,
      circleId,
      type: "LOAN_DISBURSED",
      title: "Loan disbursed",
      message: `Your approved loan of ${dec(disb.amount).toFixed(2)} has been disbursed.`,
      link: `/circles/${circleId}/loans`,
    }).catch(() => {})
    return updated
  })
}

export async function rejectDisbursement(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_DISBURSE })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (loan.status !== "DISBURSED") throw new Error(`Loan must be disbursed before rejecting its proof (status: ${loan.status})`)

  return prisma.$transaction(async (tx) => {
    await tx.loanDisbursement.update({
      where: { loanId },
      data: { status: "REJECTED" },
    })
    const updated = await tx.loan.update({ where: { id: loanId }, data: { status: "APPROVED" } })
    createAuditLog({ userId, circleId, action: "LOAN_DISBURSEMENT_REJECTED", entityType: "LoanDisbursement", entityId: loanId }).catch(() => {})
    return updated
  })
}

// ─── Repayments ───────────────────────────────────────────

export async function submitLoanRepayment(
  circleId: string,
  loanId: string,
  userId: string,
  data: { scheduleId: string; amount: number; proofUrl?: string; proofReference?: string }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAY_SUBMIT_OWN })
  const loan = await getLoanOrThrow(circleId, loanId)
  const isOwner = loan.memberId === userId
  const canSubmitForOthers = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW })
  if (!isOwner && !canSubmitForOthers) throw new Error("You can only submit repayments for your own loan")

  const schedule = await prisma.loanRepaymentSchedule.findFirst({
    where: { id: data.scheduleId, loanId },
  })
  if (!schedule) throw new Error("Repayment schedule not found")
  if (schedule.status === "CONFIRMED") throw new Error("This repayment period is already confirmed")

  const amount = new Prisma.Decimal(data.amount)

  return prisma.$transaction(async (tx) => {
    const repayment = await tx.loanRepayment.create({
      data: {
        loanId,
        scheduleId: schedule.id,
        circleId,
        memberId: loan.memberId,
        amount,
        proofUrl: data.proofUrl ?? null,
        proofReference: data.proofReference ?? null,
        status: "PROOF_SUBMITTED",
      },
    })

    await tx.loanRepaymentSchedule.update({
      where: { id: schedule.id },
      data: { status: "PROOF_SUBMITTED" },
    })

    const config = await tx.circleLoanConfig.findUnique({ where: { circleId } })
    if (config?.autoConfirmRepayments) {
      await confirmLoanRepayment(circleId, repayment.id, userId)
    }

    createAuditLog({ userId, circleId, action: "LOAN_REPAYMENT_SUBMITTED", entityType: "LoanRepayment", entityId: repayment.id, newValues: { amount: amount.toFixed(2), scheduleId: schedule.id } }).catch(() => {})
    notifyCircleMembers(circleId, userId, {
      type: "LOAN_REPAYMENT_SUBMITTED",
      title: "Repayment proof submitted",
      message: `A repayment of ${amount.toFixed(2)} has been submitted for review.`,
      link: `/circles/${circleId}/loans`,
    }).catch(() => {})
    return repayment
  })
}

export async function confirmLoanRepayment(circleId: string, repaymentId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW })
  const repayment = await prisma.loanRepayment.findFirst({
    where: { id: repaymentId, circleId },
    include: { schedule: true },
  })
  if (!repayment) throw new Error("Repayment not found")
  if (repayment.status !== "PROOF_SUBMITTED") throw new Error("Repayment is not awaiting confirmation")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.loanRepayment.update({
      where: { id: repaymentId },
      data: { status: "CONFIRMED", confirmedById: userId, confirmedAt: new Date(), completedAt: new Date() },
    })

    const existingPaid = dec(repayment.schedule.amountPaid).add(repayment.amount)
    const totalDue = dec(repayment.schedule.totalDue)

    const schedulePaid = existingPaid.gte(totalDue)
    await tx.loanRepaymentSchedule.update({
      where: { id: repayment.scheduleId },
      data: {
        amountPaid: existingPaid,
        ...(schedulePaid ? { status: "CONFIRMED", paidAt: new Date() } : {}),
      },
    })

    if (schedulePaid) {
      const pendingSchedules = await tx.loanRepaymentSchedule.count({
        where: { loanId: repayment.loanId, status: { not: "CONFIRMED" } },
      })
      if (pendingSchedules === 0) {
        await tx.loan.update({ where: { id: repayment.loanId }, data: { status: "PAID_OFF" } })
      }
    }

    createAuditLog({ userId, circleId, action: "LOAN_REPAYMENT_CONFIRMED", entityType: "LoanRepayment", entityId: repaymentId, newValues: { amount: repayment.amount } }).catch(() => {})
    createNotification({
      userId: repayment.memberId,
      circleId,
      type: "LOAN_REPAYMENT_CONFIRMED",
      title: "Repayment confirmed",
      message: `Your repayment of ${repayment.amount} has been confirmed.`,
      link: `/circles/${circleId}/loans`,
    }).catch(() => {})
    return updated
  })
}

export async function rejectLoanRepayment(circleId: string, repaymentId: string, userId: string, reason?: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW })
  const repayment = await prisma.loanRepayment.findFirst({
    where: { id: repaymentId, circleId },
    include: { schedule: true },
  })
  if (!repayment) throw new Error("Repayment not found")
  if (repayment.status !== "PROOF_SUBMITTED") throw new Error("Repayment is not awaiting confirmation")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.loanRepayment.update({
      where: { id: repaymentId },
      data: { status: "REJECTED", confirmedAt: new Date() },
    })
    await tx.loanRepaymentSchedule.update({
      where: { id: repayment.scheduleId },
      data: { status: "PENDING" },
    })
    createAuditLog({ userId, circleId, action: "LOAN_REPAYMENT_REJECTED", entityType: "LoanRepayment", entityId: repaymentId, reason: reason ?? null }).catch(() => {})
    return updated
  })
}

// ─── Arrears / status ─────────────────────────────────────

export async function markLoanOverdue(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (!["REPAYING", "DISBURSED", "APPROVED"].includes(loan.status)) throw new Error(`Cannot mark loan overdue in status ${loan.status}`)

  const now = new Date()
  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: "OVERDUE" },
  })
  await prisma.loanRepaymentSchedule.updateMany({
    where: { loanId, dueDate: { lt: now }, status: "PENDING" },
    data: { status: "OVERDUE" },
  })
  createAuditLog({ userId, circleId, action: "LOAN_OVERDUE", entityType: "Loan", entityId: loanId }).catch(() => {})
  createNotification({
    userId: loan.memberId,
    circleId,
    type: "LOAN_OVERDUE",
    title: "Loan overdue",
    message: "A loan repayment period is overdue. Please make a payment.",
    link: `/circles/${circleId}/loans`,
  }).catch(() => {})
  return updated
}

export async function markLoanDefaulted(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW })
  const loan = await getLoanOrThrow(circleId, loanId)
  if (loan.status !== "OVERDUE") throw new Error("Only overdue loans can be marked as defaulted")

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: "DEFAULTED" },
  })
  await prisma.loanRepaymentSchedule.updateMany({
    where: { loanId, status: { in: ["PENDING", "OVERDUE"] } },
    data: { status: "OVERDUE" },
  })
  createAuditLog({ userId, circleId, action: "LOAN_DEFAULTED", entityType: "Loan", entityId: loanId }).catch(() => {})
  createNotification({
    userId: loan.memberId,
    circleId,
    type: "LOAN_DEFAULTED",
    title: "Loan defaulted",
    message: "Your loan has been marked as defaulted.",
    link: `/circles/${circleId}/loans`,
  }).catch(() => {})
  return updated
}

// ─── Read APIs ────────────────────────────────────────────

export async function listLoans(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_OWN })

  const canViewAll =
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_ALL })) ||
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_VIEW }))

  const loans = await prisma.loan.findMany({
    where: { circleId, ...(canViewAll ? {} : { memberId: userId }) },
    include: {
      member: { select: { id: true, name: true, email: true } },
      schedule: { orderBy: { periodNumber: "asc" } },
      repayments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  })

  return loans.map((l) => ({
    id: l.id,
    memberId: l.memberId,
    memberName: l.member.name,
    principal: dec(l.principal).toFixed(2),
    serviceFee: dec(l.serviceFee).toFixed(2),
    interestRate: dec(l.interestRate).toFixed(4),
    termMonths: l.termMonths,
    repaymentFrequency: l.repaymentFrequency,
    status: l.status,
    purpose: l.purpose,
    requestedAt: l.requestedAt,
    approvedAt: l.approvedAt,
    disbursedAt: l.disbursedAt,
    schedule: l.schedule.map((s) => ({
      id: s.id,
      periodNumber: s.periodNumber,
      dueDate: s.dueDate,
      principalDue: dec(s.principalDue).toFixed(2),
      interestDue: dec(s.interestDue).toFixed(2),
      totalDue: dec(s.totalDue).toFixed(2),
      amountPaid: dec(s.amountPaid).toFixed(2),
      status: s.status,
    })),
    repaymentCount: l.repayments.length,
  }))
}

export async function getLoan(circleId: string, loanId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_OWN })
  const loan = await getLoanOrThrow(circleId, loanId)

  const canViewAny =
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_ALL })) ||
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_VIEW }))
  if (!canViewAny && loan.memberId !== userId) throw new Error("Not found")

  const repayments = await prisma.loanRepayment.findMany({
    where: { loanId, circleId },
    orderBy: { createdAt: "desc" },
    include: { confirmedBy: { select: { id: true, name: true } } },
  })

  return {
    id: loan.id,
    memberId: loan.memberId,
    principal: dec(loan.principal).toFixed(2),
    serviceFee: dec(loan.serviceFee).toFixed(2),
    interestRate: dec(loan.interestRate).toFixed(4),
    termMonths: loan.termMonths,
    repaymentFrequency: loan.repaymentFrequency,
    status: loan.status,
    purpose: loan.purpose,
    requestedAt: loan.requestedAt,
    approvedAt: loan.approvedAt,
    disbursedAt: loan.disbursedAt,
    schedule: loan.schedule.map((s) => ({
      id: s.id,
      periodNumber: s.periodNumber,
      dueDate: s.dueDate,
      principalDue: dec(s.principalDue).toFixed(2),
      interestDue: dec(s.interestDue).toFixed(2),
      totalDue: dec(s.totalDue).toFixed(2),
      amountPaid: dec(s.amountPaid).toFixed(2),
      status: s.status,
    })),
    repayments: repayments.map((r) => ({
      id: r.id,
      scheduleId: r.scheduleId,
      amount: dec(r.amount).toFixed(2),
      status: r.status,
      proofUrl: r.proofUrl,
      proofReference: r.proofReference,
      confirmedByName: r.confirmedBy?.name ?? null,
      confirmedAt: r.confirmedAt,
      createdAt: r.createdAt,
    })),
    canViewAny,
  }
}

export async function getLoanDashboardStatus(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_OWN })
  const canViewAll =
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_ALL })) ||
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_VIEW }))

  const [config, myLoans, allLoans, pendingReview] = await Promise.all([
    prisma.circleLoanConfig.findUnique({ where: { circleId } }),
    prisma.loan.findMany({
      where: { circleId, memberId: userId },
      orderBy: { createdAt: "desc" },
    }),
    canViewAll
      ? prisma.loan.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    canViewAll
      ? prisma.loan.count({ where: { circleId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })
      : Promise.resolve(0),
  ])

  return {
    enabled: config?.enabled ?? false,
    totalLoans: canViewAll ? allLoans.length : myLoans.length,
    pendingReview,
    myActiveLoans: myLoans.filter((l) => ACTIVE_LOAN_STATUSES.includes(l.status as LoanStatus)).length,
    latestStatus: myLoans[0]?.status ?? null,
  }
}
