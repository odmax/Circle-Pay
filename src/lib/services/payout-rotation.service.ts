import { prisma } from "@/lib/prisma"
import type {
  PayoutMode,
  PayoutFrequency,
  PayoutCycleStatus,
  PayoutConfig,
  PayoutCycle,
  MemberRole,
  NotificationType,
} from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import {
  createNotification,
  notifyCircleMembers,
  createBulkNotifications,
} from "@/lib/services/notification.service"
import { createApprovalRequest } from "@/lib/services/approval.service"
import { recordPayoutToLedger } from "@/lib/services/wallet.service"
import { getCircleReviewers } from "@/lib/services/approval.service"

const DAY_MS = 86400000

// ─── Config ────────────────────────────────────────────────

export async function getPayoutConfig(circleId: string): Promise<PayoutConfig | null> {
  return prisma.payoutConfig.findUnique({ where: { circleId } })
}

export async function upsertPayoutConfig(
  circleId: string,
  userId: string,
  data: {
    mode?: PayoutMode
    frequency?: PayoutFrequency
    amount?: number | null
    useCollectedPot?: boolean
    startDate?: string | null
    graceDays?: number
    requireConfirmedContributions?: boolean
    minimumApprovals?: number
    requireBeneficiaryConfirmation?: boolean
    allowSwap?: boolean
    isActive?: boolean
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_CONFIGURE })

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "STOKVEL") throw new Error("Not a stokvel circle")

  const existing = await prisma.payoutConfig.findUnique({ where: { circleId } })

  const payload: Record<string, unknown> = {
    ...(data.mode !== undefined && { mode: data.mode }),
    ...(data.frequency !== undefined && { frequency: data.frequency }),
    ...(data.amount !== undefined && { amount: data.amount }),
    ...(data.useCollectedPot !== undefined && { useCollectedPot: data.useCollectedPot }),
    ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
    ...(data.graceDays !== undefined && { graceDays: data.graceDays }),
    ...(data.requireConfirmedContributions !== undefined && { requireConfirmedContributions: data.requireConfirmedContributions }),
    ...(data.minimumApprovals !== undefined && { minimumApprovals: data.minimumApprovals }),
    ...(data.requireBeneficiaryConfirmation !== undefined && { requireBeneficiaryConfirmation: data.requireBeneficiaryConfirmation }),
    ...(data.allowSwap !== undefined && { allowSwap: data.allowSwap }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
  }

  const config = existing
    ? await prisma.payoutConfig.update({ where: { circleId }, data: payload })
    : await prisma.payoutConfig.create({
        data: {
          circleId,
          createdById: userId,
          ...(payload as any),
        },
      })

  await createAuditLog({
    userId,
    circleId,
    action: existing ? "PAYOUT_CONFIG_UPDATED" : "PAYOUT_CONFIG_CREATED",
    entityType: "PayoutConfig",
    entityId: config.id,
    newValues: payload,
  })

  return config
}

// ─── Queue Creation ────────────────────────────────────────

async function getEligibleMembers(circleId: string): Promise<{ userId: string; name: string; email: string }[]> {
  const members = await prisma.circleMember.findMany({
    where: { circleId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  })
  return members.map((m) => ({ userId: m.user.id, name: m.user.name || m.user.email, email: m.user.email }))
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function createPayoutQueue(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_MANAGE })

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "STOKVEL") throw new Error("Not a stokvel circle")

  const existing = await prisma.payoutCycle.count({ where: { circleId } })
  if (existing > 0) throw new Error("Payout queue already exists")

  let config = await prisma.payoutConfig.findUnique({ where: { circleId } })
  if (!config) {
    config = await prisma.payoutConfig.create({
      data: { circleId, createdById: userId, mode: "FIXED_ORDER", frequency: "MONTHLY" },
    })
  }

  const members = await getEligibleMembers(circleId)
  if (members.length < 2) throw new Error("At least two members are required to create a payout queue")

  let order = members.map((m) => m.userId)
  if (config.mode === "RANDOM_DRAW") {
    order = shuffled(order)
  }

  const settings = (await prisma.circle.findUnique({ where: { id: circleId }, select: { settings: true } }))?.settings as Record<string, unknown> | null
  const configuredAmount = config.amount !== null && config.amount !== undefined
    ? Number(config.amount)
    : Number(settings?.contributionAmount || 0)

  const cycles = order.length
  const startDate = config.startDate ?? new Date()

  const created: PayoutCycle[] = []
  for (let i = 0; i < cycles; i++) {
    const intervalMs = config.frequency === "WEEKLY" ? 7 : config.frequency === "QUARTERLY" ? 91 : config.frequency === "CUSTOM" ? 30 : 30
    const dueDate = new Date(startDate.getTime() + (i + 1) * intervalMs * DAY_MS)
    const cycle = await prisma.payoutCycle.create({
      data: {
        circleId,
        configId: config.id,
        cycleNumber: i + 1,
        recipientId: order[i],
        amount: configuredAmount,
        dueDate,
        status: "UPCOMING",
        drawAt: config.mode === "RANDOM_DRAW" ? new Date() : null,
        drawEligibleIds: config.mode === "RANDOM_DRAW" ? (order as any) : null,
      },
    })
    created.push(cycle)
  }

  notifyCircleMembers(circleId, userId, {
    type: "PAYOUT_QUEUE_CREATED",
    title: "Payout rotation created",
    message: `A ${config.mode.replace(/_/g, " ").toLowerCase()} payout rotation has been set up for ${cycles} members`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})

  await createAuditLog({
    userId,
    circleId,
    action: "PAYOUT_QUEUE_CREATED",
    entityType: "PayoutCycle",
    newValues: { mode: config.mode, cycles, amount: configuredAmount },
  })

  await createPayoutEvent(circleId, undefined, userId, "QUEUE_CREATED", { mode: config.mode, cycles })

  return { count: created.length }
}

export async function getPayoutQueue(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_VIEW_ALL })

  const [cycles, config, compliance, myCycle] = await Promise.all([
    prisma.payoutCycle.findMany({
      where: { circleId },
      include: {
        recipient: { select: { id: true, name: true, email: true, image: true } },
        payment: true,
      },
      orderBy: { cycleNumber: "asc" },
    }),
    getPayoutConfig(circleId),
    getPoolCompliance(circleId),
    prisma.payoutCycle.findFirst({
      where: { circleId, recipientId: userId, status: { in: ["UPCOMING", "READY", "PENDING_APPROVAL", "APPROVED"] } },
      orderBy: { cycleNumber: "asc" },
    }),
  ])

  await refreshPayoutStatuses(circleId)

  const fresh = await prisma.payoutCycle.findMany({
    where: { circleId },
    include: {
      recipient: { select: { id: true, name: true, email: true, image: true } },
      payment: true,
    },
    orderBy: { cycleNumber: "asc" },
  })

  return {
    config: config
      ? { ...config, amount: config.amount ? Number(config.amount) : null }
      : null,
    compliance,
    myCycle: myCycle ? { cycleNumber: myCycle.cycleNumber, status: myCycle.status, amount: Number(myCycle.amount), dueDate: myCycle.dueDate } : null,
    queue: fresh.map((c) => ({
      id: c.id,
      cycleNumber: c.cycleNumber,
      recipient: c.recipient,
      amount: Number(c.amount),
      dueDate: c.dueDate,
      status: c.status,
      completionStatus: c.completionStatus,
      readiness: c.readiness,
      paymentMethod: c.paymentMethod,
      reference: c.reference,
      proofUrl: c.proofUrl,
      skipReason: c.skipReason,
      deferReason: c.deferReason,
      confirmedAt: c.confirmedAt,
      paidAt: c.paidAt,
    })),
    canManage: await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_MANAGE }),
    canRecord: await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_RECORD }),
    canPrepare: await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_PREPARE }),
  }
}

export async function getMyPayout(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_VIEW_ALL })

  const cycle = await prisma.payoutCycle.findFirst({
    where: { circleId, recipientId: userId, status: { in: ["UPCOMING", "READY", "PENDING_APPROVAL", "APPROVED", "PAID"] } },
    include: { recipient: { select: { id: true, name: true, image: true } }, payment: true },
    orderBy: { cycleNumber: "asc" },
  })
  return cycle
}

// ─── Readiness Engine ──────────────────────────────────────

export async function getPoolCompliance(circleId: string) {
  const settings = (await prisma.circle.findUnique({ where: { id: circleId }, select: { settings: true } }))?.settings as Record<string, unknown> | null
  const expectedPerMember = Number(settings?.contributionAmount || 0)
  const members = await prisma.circleMember.count({ where: { circleId } })
  const expectedTotal = expectedPerMember * members

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [confirmed, all] = await Promise.all([
    prisma.contribution.aggregate({
      where: { circleId, status: { in: ["PAID", "CONFIRMED"] }, paymentDate: { gte: monthStart }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.contribution.aggregate({
      where: { circleId, status: { in: ["PAID", "CONFIRMED"] }, deletedAt: null },
      _sum: { amount: true },
    }),
  ])

  return {
    expectedPerMember,
    members,
    expectedTotal,
    collected: Number(confirmed._sum.amount ?? 0),
    totalCollected: Number(all._sum.amount ?? 0),
    shortfall: expectedTotal - Number(confirmed._sum.amount ?? 0),
  }
}

async function resolvePayoutAmount(config: PayoutConfig, circleId: string): Promise<number> {
  if (config.useCollectedPot) {
    const compliance = await getPoolCompliance(circleId)
    return compliance.collected
  }
  if (config.amount !== null && config.amount !== undefined) return Number(config.amount)
  const settings = (await prisma.circle.findUnique({ where: { id: circleId }, select: { settings: true } }))?.settings as Record<string, unknown> | null
  return Number(settings?.contributionAmount || 0)
}

export async function evaluateCycleReadiness(circleId: string, cycle: PayoutCycle) {
  const config = (cycle.configId
    ? await prisma.payoutConfig.findUnique({ where: { id: cycle.configId } })
    : await getPayoutConfig(circleId)) ?? (await getPayoutConfig(circleId))

  const blockers: string[] = []

  if (config && !config.isActive) {
    blockers.push("Payout configuration is inactive")
  }

  // Beneficiary still active
  const recipient = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: cycle.recipientId } },
  })
  if (!recipient) {
    blockers.push("Beneficiary is no longer an active member")
  }

  // Required contributions confirmed
  if (config?.requireConfirmedContributions) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const allMembers = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
    const paid = await prisma.contribution.groupBy({
      by: ["userId"],
      where: { circleId, status: { in: ["PAID", "CONFIRMED"] }, paymentDate: { gte: monthStart }, deletedAt: null },
    })
    const paidIds = new Set(paid.map((p) => p.userId))
    const outstanding = allMembers.filter((m) => !paidIds.has(m.userId))
    if (outstanding.length > 0) {
      blockers.push(`${outstanding.length} member contribution${outstanding.length === 1 ? " is" : "s are"} still outstanding`)
    }
  }

  // Payout amount available
  const amount = config ? await resolvePayoutAmount(config, circleId) : Number(cycle.amount)
  const compliance = await getPoolCompliance(circleId)
  if (compliance.collected < amount) {
    blockers.push(`Available funds (${compliance.collected}) are less than the payout amount (${amount})`)
  }

  // Unresolved blocking approval (a PENDING approval on this cycle blocks readiness → handled via PENDING_APPROVAL status instead)
  if (cycle.status === "BLOCKED") {
    blockers.push("Payout is blocked")
  }

  return { amount, blockers }
}

export async function refreshPayoutStatuses(circleId: string) {
  const cycles = await prisma.payoutCycle.findMany({
    where: { circleId, status: { in: ["UPCOMING", "READY", "BLOCKED"] } },
  })
  const config = await getPayoutConfig(circleId)

  for (const cycle of cycles) {
    const { amount, blockers } = await evaluateCycleReadiness(circleId, cycle)

    let nextStatus: PayoutCycleStatus = "READY"
    if (blockers.length > 0) {
      nextStatus = "BLOCKED"
    } else if (cycle.dueDate && new Date(cycle.dueDate).getTime() > Date.now() + (config?.graceDays ?? 0) * DAY_MS) {
      nextStatus = "UPCOMING"
    }

    if (nextStatus === "BLOCKED") {
      if (cycle.status !== "BLOCKED") {
        await prisma.payoutCycle.update({
          where: { id: cycle.id },
          data: { status: "BLOCKED", readiness: blockers.join("; ") },
        })
        await createPayoutEvent(circleId, cycle.id, null, "BLOCKED", { blockers, reason: blockers.join("; ") })
        notifyAdmins(circleId, `Payout #${cycle.cycleNumber} blocked`, blockers.join(". "), `/circles/${circleId}/payouts`, "PAYOUT_BLOCKED").catch(() => {})
      } else if (cycle.readiness !== blockers.join("; ")) {
        await prisma.payoutCycle.update({ where: { id: cycle.id }, data: { readiness: blockers.join("; ") } })
      }
    } else if (nextStatus === "READY" && cycle.status !== "READY") {
      await prisma.payoutCycle.update({
        where: { id: cycle.id },
        data: { status: "READY", readiness: "READY", amount, readiedAt: new Date() },
      })
      await createPayoutEvent(circleId, cycle.id, null, "READY", { amount })
      // Notify recipient
      createNotification({
        userId: cycle.recipientId,
        circleId,
        type: "PAYOUT_READY",
        title: "Your payout is ready",
        message: `Your payout of ${amount} is ready and awaiting processing`,
        link: `/circles/${circleId}/payouts`,
      }).catch(() => {})
      notifyAdmins(circleId, `Payout #${cycle.cycleNumber} ready`, `${amount} is ready to be paid to ${cycle.recipientId}`, `/circles/${circleId}/payouts`, "PAYOUT_READY").catch(() => {})
    }
  }
}

async function notifyAdmins(circleId: string, title: string, message: string, link: string, type: NotificationType) {
  const reviewers = await getCircleReviewers(circleId)
  if (reviewers.length === 0) return
  return createBulkNotifications(
    reviewers.map((u) => ({ userId: u, circleId, type, title, message, link }))
  )
}

// ─── Admin Workflow ────────────────────────────────────────

export async function preparePayout(circleId: string, cycleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_PREPARE })

  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")
  if (cycle.status !== "READY" && cycle.status !== "UPCOMING" && cycle.status !== "BLOCKED") {
    throw new Error("Payout is not ready for preparation")
  }

  const config = (cycle.configId ? await prisma.payoutConfig.findUnique({ where: { id: cycle.configId } }) : null) ?? (await getPayoutConfig(circleId))
  const amount = cycle.amount !== null ? Number(cycle.amount) : (config ? await resolvePayoutAmount(config, circleId) : Number(cycle.amount))
  const minApprovals = config?.minimumApprovals ?? 1
  const approvalRequired = minApprovals > 0

  if (approvalRequired) {
    const request = await createApprovalRequest({
      circleId,
      type: "PAYOUT",
      resourceId: cycle.id,
      title: `Approve payout of ${amount} to cycle #${cycle.cycleNumber}`,
      description: `Authorise the payout to ${cycle.recipientId}`,
      requestedById: userId,
      amount,
      metadata: { payoutCycleId: cycle.id, cycleNumber: cycle.cycleNumber, recipientId: cycle.recipientId },
    })

    await prisma.$transaction(async (tx) => {
      await tx.payoutCycle.update({
        where: { id: cycle.id },
        data: { status: "PENDING_APPROVAL", approvalRequestId: request.id, amount },
      })
      await tx.auditLog.create({
        data: {
          userId,
          circleId,
          action: "PAYOUT_PREPARED",
          entityType: "PayoutCycle",
          entityId: cycle.id,
          newValues: { status: "PENDING_APPROVAL", amount, approvalRequestId: request.id },
        },
      })
    })

    await createPayoutEvent(circleId, cycle.id, userId, "PENDING_APPROVAL", { amount })
    notifyAdmins(circleId, `Payout #${cycle.cycleNumber} needs approval`, `A payout of ${amount} requires ${minApprovals} approval(s)`, `/circles/${circleId}/payouts`, "PAYOUT_APPROVAL_REQUIRED").catch(() => {})
    return { status: "PENDING_APPROVAL", approvalRequestId: request.id }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payoutCycle.update({
      where: { id: cycle.id },
      data: { status: "APPROVED", amount, approvedAt: new Date(), readiness: "APPROVED" },
    })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_APPROVED",
        entityType: "PayoutCycle",
        entityId: cycle.id,
        newValues: { status: "APPROVED", amount },
      },
    })
  })

  await createPayoutEvent(circleId, cycle.id, userId, "APPROVED", { amount })
  createNotification({
    userId: cycle.recipientId,
    circleId,
    type: "PAYOUT_APPROVED",
    title: "Payout approved",
    message: `Your payout of ${amount} has been approved and is ready for payment`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})
  return { status: "APPROVED" }
}

export async function recordPayoutPayment(
  circleId: string,
  cycleId: string,
  userId: string,
  data: {
    amount?: number
    paidDate?: string | null
    method?: string
    reference?: string
    notes?: string
    proofUrl?: string | null
    proofReference?: string | null
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_RECORD })

  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")

  if (cycle.status !== "APPROVED" && cycle.status !== "PENDING_APPROVAL") {
    throw new Error("Payout must be approved before recording payment")
  }

  // If pending approval, verify the linked approval request is approved
  if (cycle.status === "PENDING_APPROVAL" && cycle.approvalRequestId) {
    const req = await prisma.approvalRequest.findUnique({ where: { id: cycle.approvalRequestId } })
    if (req && req.status !== "APPROVED") {
      throw new Error("Payout has not been approved yet")
    }
    if (req?.status === "APPROVED") {
      await prisma.payoutCycle.update({ where: { id: cycle.id }, data: { status: "APPROVED", approvedAt: new Date() } })
    }
  }

  const idempotencyKey = `payout-payment:${cycleId}`
  const existingPayment = await prisma.payoutPayment.findUnique({ where: { idempotencyKey } })
  if (existingPayment) return { status: "PAID", alreadyRecorded: true, id: existingPayment.id }

  const amount = data.amount !== undefined ? data.amount : Number(cycle.amount)
  const available = (await getPoolCompliance(circleId)).totalCollected
  if (amount > available) {
    throw new Error(`Payout amount ${amount} exceeds available collected funds ${available}`)
  }

  const payment = await prisma.$transaction(async (tx) => {
    const payment = await tx.payoutPayment.create({
      data: {
        cycleId: cycle.id,
        circleId,
        recipientId: cycle.recipientId,
        amount,
        paidDate: data.paidDate ? new Date(data.paidDate) : new Date(),
        method: data.method || null,
        reference: data.reference || null,
        proofUrl: data.proofUrl || null,
        proofReference: data.proofReference || null,
        notes: data.notes || null,
        paidById: userId,
        idempotencyKey,
      },
    })

    await tx.payoutCycle.update({
      where: { id: cycle.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: data.method || null,
        reference: data.reference || null,
        proofUrl: data.proofUrl || null,
        proofReference: data.proofReference || null,
        amount,
      },
    })

    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_PAID",
        entityType: "PayoutPayment",
        entityId: payment.id,
        newValues: { cycleId: cycle.id, amount, method: data.method, reference: data.reference },
      },
    })

    return payment
  })

  // Ledger recording (idempotent) outside the tx — fire and forget but awaited
  recordPayoutToLedger(circleId, payment.id, amount, userId).catch(console.error)

  await createPayoutEvent(circleId, cycle.id, userId, "PAID", { amount, method: data.method, reference: data.reference })

  createNotification({
    userId: cycle.recipientId,
    circleId,
    type: "PAYOUT_PAID",
    title: "Payout paid",
    message: `Your payout of ${amount} has been paid${data.reference ? ` (Ref: ${data.reference})` : ""}`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "PAYOUT_PAID",
    title: `Payout #${cycle.cycleNumber} paid`,
    message: `A payout of ${amount} has been paid`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})

  return { status: "PAID", id: payment.id, alreadyRecorded: false }
}

export async function uploadPayoutProof(circleId: string, cycleId: string, userId: string, proofUrl: string, proofReference?: string | null) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_RECORD })

  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")
  if (cycle.status !== "PAID" && cycle.status !== "APPROVED") {
    throw new Error("Payout must be paid or approved to attach proof")
  }

  await prisma.$transaction(async (tx) => {
    await tx.payoutCycle.update({
      where: { id: cycle.id },
      data: { proofUrl, proofReference: proofReference || null, proofUploadedById: userId },
    })
    await tx.payoutPayment.updateMany({
      where: { cycleId: cycle.id },
      data: { proofUrl, proofReference: proofReference || null },
    })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_PROOF_UPLOADED",
        entityType: "PayoutCycle",
        entityId: cycle.id,
        newValues: { proofUrl, proofReference },
      },
    })
  })

  await createPayoutEvent(circleId, cycle.id, userId, "PROOF_UPLOADED", { proofUrl })
  return { success: true }
}

// ─── Beneficiary Confirmation ──────────────────────────────

export async function confirmPayoutReceived(circleId: string, cycleId: string, userId: string) {
  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")

  // Only the beneficiary may confirm their own payout (or managers with PAYOUT_CONFIRM policy — but keep beneficiary-focused)
  const isBeneficiary = cycle.recipientId === userId
  if (!isBeneficiary) {
    const canConfirm = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_CONFIRM })
    if (!canConfirm) throw new Error("Only the beneficiary or an authorised member can confirm receipt")
  }

  if (cycle.status === "CONFIRMED_RECEIVED" || cycle.status === "COMPLETED") {
    return { status: cycle.status, alreadyConfirmed: true }
  }
  if (cycle.status !== "PAID") {
    throw new Error("Payout must be paid before confirming receipt")
  }

  await prisma.$transaction(async (tx) => {
    await tx.payoutCycle.update({
      where: { id: cycle.id },
      data: { status: "CONFIRMED_RECEIVED", confirmedAt: new Date(), completedAt: new Date() },
    })
    await tx.payoutPayment.updateMany({
      where: { cycleId: cycle.id },
      data: { confirmedById: userId, confirmedAt: new Date() },
    })
    // Mark recipient's cycle as completed
    await tx.payoutEvent.create({
      data: {
        circleId,
        cycleId: cycle.id,
        type: "CONFIRMED",
        actorId: userId,
        recipientId: cycle.recipientId,
        amount: cycle.amount,
        note: "Beneficiary confirmed receipt",
      },
    })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_CONFIRMED_RECEIVED",
        entityType: "PayoutCycle",
        entityId: cycle.id,
        newValues: { status: "CONFIRMED_RECEIVED" },
      },
    })
  })

  notifyCircleMembers(circleId, userId, {
    type: "PAYOUT_CONFIRMED_RECEIVED",
    title: `Payout #${cycle.cycleNumber} confirmed`,
    message: "The beneficiary has confirmed receipt of the payout",
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})
  notifyAdmins(circleId, `Payout #${cycle.cycleNumber} confirmed`, "The beneficiary confirmed receipt", `/circles/${circleId}/payouts`, "PAYOUT_CONFIRMED_RECEIVED").catch(() => {})

  return { status: "CONFIRMED_RECEIVED", alreadyConfirmed: false }
}

// ─── Skip / Defer / Swap ───────────────────────────────────

export async function skipPayout(circleId: string, cycleId: string, userId: string, reason: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_SKIP_DEFER })

  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")
  if (!["UPCOMING", "READY", "BLOCKED", "PENDING_APPROVAL"].includes(cycle.status)) {
    throw new Error("Payout cannot be skipped in its current state")
  }
  if (!reason) throw new Error("A reason is required to skip a payout")

  const oldStatus = cycle.status
  await prisma.$transaction(async (tx) => {
    await tx.payoutCycle.update({
      where: { id: cycle.id },
      data: { status: "SKIPPED", skipReason: reason, completedAt: new Date() },
    })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_SKIPPED",
        entityType: "PayoutCycle",
        entityId: cycle.id,
        reason,
        oldValues: { status: oldStatus },
        newValues: { status: "SKIPPED" },
      },
    })
  })

  await createPayoutEvent(circleId, cycle.id, userId, "SKIPPED", { reason }, cycle.recipientId)
  createNotification({
    userId: cycle.recipientId,
    circleId,
    type: "PAYOUT_SKIPPED",
    title: "Payout skipped",
    message: `Your payout of ${Number(cycle.amount)} was skipped: ${reason}`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "PAYOUT_QUEUE_CHANGED",
    title: `Payout #${cycle.cycleNumber} skipped`,
    message: `Cycle skipped: ${reason}`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})

  return { status: "SKIPPED" }
}

export async function deferPayout(circleId: string, cycleId: string, userId: string, reason: string, toCycleNumber?: number) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_SKIP_DEFER })

  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")
  if (!["UPCOMING", "READY", "BLOCKED"].includes(cycle.status)) {
    throw new Error("Payout cannot be deferred in its current state")
  }
  if (!reason) throw new Error("A reason is required to defer a payout")

  const oldStatus = cycle.status
  await prisma.$transaction(async (tx) => {
    await tx.payoutCycle.update({
      where: { id: cycle.id },
      data: { status: "DEFERRED", deferReason: reason, deferToCycleNumber: toCycleNumber ?? null },
    })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_DEFERRED",
        entityType: "PayoutCycle",
        entityId: cycle.id,
        reason,
        oldValues: { status: oldStatus },
        newValues: { status: "DEFERRED", deferToCycleNumber: toCycleNumber ?? null },
      },
    })
  })

  await createPayoutEvent(circleId, cycle.id, userId, "DEFERRED", { reason, toCycleNumber }, cycle.recipientId)
  createNotification({
    userId: cycle.recipientId,
    circleId,
    type: "PAYOUT_DEFERRED",
    title: "Payout deferred",
    message: `Your payout was deferred${toCycleNumber ? ` to cycle #${toCycleNumber}` : ""}: ${reason}`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "PAYOUT_QUEUE_CHANGED",
    title: `Payout #${cycle.cycleNumber} deferred`,
    message: `Cycle deferred${toCycleNumber ? ` to #${toCycleNumber}` : ""}: ${reason}`,
    link: `/circles/${circleId}/payouts`,
  }).catch(() => {})

  return { status: "DEFERRED" }
}

export async function swapPayoutPositions(circleId: string, fromCycleId: string, toCycleId: string, userId: string, reason: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_SWAP })

  const config = await getPayoutConfig(circleId)
  if (!config?.allowSwap) {
    throw new Error("Queue swapping is not permitted by the payout policy")
  }
  if (!reason) throw new Error("A reason is required to swap queue positions")

  const from = await prisma.payoutCycle.findUnique({ where: { id: fromCycleId } })
  const to = await prisma.payoutCycle.findUnique({ where: { id: toCycleId } })
  if (!from || from.circleId !== circleId || !to || to.circleId !== circleId) throw new Error("Payout cycle not found")
  if (from.cycleNumber === to.cycleNumber) throw new Error("Cannot swap a cycle with itself")
  if (!["UPCOMING", "READY", "BLOCKED"].includes(from.status) || !["UPCOMING", "READY", "BLOCKED"].includes(to.status)) {
    throw new Error("Only upcoming or ready cycles can be swapped")
  }

  const fromRecipient = from.recipientId
  const toRecipient = to.recipientId
  const fromDue = from.dueDate
  const toDue = to.dueDate

  await prisma.$transaction(async (tx) => {
    await tx.payoutCycle.update({ where: { id: from.id }, data: { recipientId: toRecipient, dueDate: toDue ?? fromDue, orderedBy: userId } })
    await tx.payoutCycle.update({ where: { id: to.id }, data: { recipientId: fromRecipient, dueDate: fromDue ?? toDue, orderedBy: userId } })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_SWAPPED",
        entityType: "PayoutCycle",
        entityId: from.id,
        reason,
        oldValues: { cycleNumber: from.cycleNumber, recipientId: fromRecipient },
        newValues: { cycleNumber: to.cycleNumber, recipientId: toRecipient },
      },
    })
    await tx.auditLog.create({
      data: {
        userId,
        circleId,
        action: "PAYOUT_SWAPPED",
        entityType: "PayoutCycle",
        entityId: to.id,
        reason,
        oldValues: { cycleNumber: to.cycleNumber, recipientId: toRecipient },
        newValues: { cycleNumber: from.cycleNumber, recipientId: fromRecipient },
      },
    })
  })

  await createPayoutEvent(circleId, from.id, userId, "SWAPPED", { reason, swappedWith: to.cycleNumber }, fromRecipient)
  await createPayoutEvent(circleId, to.id, userId, "SWAPPED", { reason, swappedWith: from.cycleNumber }, toRecipient)

  createBulkNotifications([
    {
      userId: fromRecipient,
      circleId,
      type: "PAYOUT_QUEUE_CHANGED",
      title: "Queue position changed",
      message: `Your payout was moved to cycle #${to.cycleNumber} by an administrator: ${reason}`,
      link: `/circles/${circleId}/payouts`,
    },
    {
      userId: toRecipient,
      circleId,
      type: "PAYOUT_QUEUE_CHANGED",
      title: "Queue position changed",
      message: `Your payout was moved to cycle #${from.cycleNumber} by an administrator: ${reason}`,
      link: `/circles/${circleId}/payouts`,
    },
  ]).catch(() => {})

  return { success: true }
}

// ─── Random Draw ───────────────────────────────────────────

export async function drawRandomPayout(circleId: string, userId: string, excludeAlreadyPaid?: boolean) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_MANAGE })

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "STOKVEL") throw new Error("Not a stokvel circle")
  const config = await getPayoutConfig(circleId)
  if (!config || config.mode !== "RANDOM_DRAW") throw new Error("Circle is not configured for random draw")

  let members = await getEligibleMembers(circleId)

  if (excludeAlreadyPaid) {
    const paidRecipients = await prisma.payoutCycle.findMany({
      where: { circleId, status: { in: ["PAID", "CONFIRMED_RECEIVED", "COMPLETED"] } },
      select: { recipientId: true },
    })
    const paidIds = new Set(paidRecipients.map((p) => p.recipientId))
    members = members.filter((m) => !paidIds.has(m.userId))
  }

  if (members.length === 0) throw new Error("No eligible members to draw from")

  const eligibleSnapshot = members.map((m) => ({ userId: m.userId, name: m.name }))
  const selected = members[Math.floor(Math.random() * members.length)]

  // Create a new queue with the drawn individual as first, rest randomized
  await prisma.payoutCycle.deleteMany({ where: { circleId } })
  const rest = shuffled(members.filter((m) => m.userId !== selected.userId))
  const order = [selected.userId, ...rest.map((m) => m.userId)]

  const amount = config.amount !== null && config.amount !== undefined ? Number(config.amount) : 0
  const startDate = config.startDate ?? new Date()

  for (let i = 0; i < order.length; i++) {
    await prisma.payoutCycle.create({
      data: {
        circleId,
        configId: config.id,
        cycleNumber: i + 1,
        recipientId: order[i],
        amount,
        dueDate: new Date(startDate.getTime() + (i + 1) * 30 * DAY_MS),
        status: "UPCOMING",
        drawAt: i === 0 ? new Date() : null,
        drawEligibleIds: eligibleSnapshot as any,
      },
    })
  }

  await createAuditLog({
    userId,
    circleId,
    action: "PAYOUT_RANDOM_DRAW",
    entityType: "PayoutCycle",
    newValues: { selectedRecipientId: selected.userId, eligibleCount: eligibleSnapshot.length, eligibleSnapshot },
  })
  await createPayoutEvent(circleId, undefined, userId, "DRAW", { selectedRecipientId: selected.userId, eligibleCount: eligibleSnapshot.length })

  createBulkNotifications(
    eligibleSnapshot.map((m) => ({
      userId: m.userId,
      circleId,
      type: "PAYOUT_DRAW_COMPLETED",
      title: m.userId === selected.userId ? "You won the payout draw" : "Payout draw completed",
      message: m.userId === selected.userId
        ? "You have been selected for the next payout!"
        : "The payout draw has been completed",
      link: `/circles/${circleId}/payouts`,
    }))
  ).catch(() => {})

  return { selectedUserId: selected.userId, selectedName: selected.name, eligibleCount: eligibleSnapshot.length }
}

// ─── Beneficiary Issue ─────────────────────────────────────

export async function reportPayoutIssue(circleId: string, cycleId: string, userId: string, description: string) {
  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Payout cycle not found")

  const isBeneficiary = cycle.recipientId === userId
  const canReport = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_ISSUE })
  if (!isBeneficiary && !canReport) throw new Error("Only the beneficiary or an authorised member can report an issue")
  if (!description) throw new Error("A description is required")

  await prisma.$transaction(async (tx) => {
    await tx.payoutPayment.updateMany({
      where: { cycleId: cycle.id },
      data: { issueReported: true, issueDescription: description },
    })
    await tx.payoutEvent.create({
      data: { circleId, cycleId: cycle.id, type: "ISSUE", actorId: userId, recipientId: cycle.recipientId, note: description },
    })
  })

  await createAuditLog({
    userId,
    circleId,
    action: "PAYOUT_ISSUE_REPORTED",
    entityType: "PayoutCycle",
    entityId: cycle.id,
    newValues: { description },
  })

  notifyAdmins(circleId, `Payout #${cycle.cycleNumber} issue reported`, description, `/circles/${circleId}/payouts`, "PAYOUT_ISSUE_REPORTED").catch(() => {})
  return { success: true }
}

// ─── History ───────────────────────────────────────────────

export async function getPayoutHistory(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_VIEW_ALL })

  const cycles = await prisma.payoutCycle.findMany({
    where: { circleId, status: { in: ["PAID", "CONFIRMED_RECEIVED", "COMPLETED", "SKIPPED", "DEFERRED"] } },
    include: {
      recipient: { select: { id: true, name: true, email: true, image: true } },
      payment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { completedAt: "desc" },
    take: 100,
  })

  return cycles.map((c) => ({
    id: c.id,
    cycleNumber: c.cycleNumber,
    recipient: c.recipient,
    amount: Number(c.amount),
    scheduledDate: c.dueDate,
    paidDate: c.paidAt,
    completedAt: c.completedAt,
    status: c.status,
    paymentMethod: c.paymentMethod,
    reference: c.reference,
    proofUrl: c.proofUrl,
    confirmation: c.confirmedAt ? { confirmedAt: c.confirmedAt, confirmedById: c.payment?.confirmedById ?? null } : null,
    skipReason: c.skipReason,
    deferReason: c.deferReason,
    events: c.events.map((e) => ({ type: e.type, note: e.note, createdAt: e.createdAt })),
  }))
}

// ─── Progress summary for dashboard ───────────────────────

export async function getPayoutProgress(circleId: string) {
  const [total, completed, blocked, ready, config] = await Promise.all([
    prisma.payoutCycle.count({ where: { circleId } }),
    prisma.payoutCycle.count({ where: { circleId, status: { in: ["COMPLETED", "CONFIRMED_RECEIVED", "PAID"] } } }),
    prisma.payoutCycle.count({ where: { circleId, status: "BLOCKED" } }),
    prisma.payoutCycle.count({ where: { circleId, status: "READY" } }),
    getPayoutConfig(circleId),
  ])
  return {
    total,
    completed,
    blocked,
    ready,
    remaining: total - completed,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    mode: config?.mode ?? "FIXED_ORDER",
  }
}

// ─── Shared helper ─────────────────────────────────────────

async function createPayoutEvent(
  circleId: string,
  cycleId: string | undefined,
  actorId: string | null,
  type: string,
  metadata?: Record<string, unknown>,
  recipientId?: string | null
) {
  const cycle = cycleId ? await prisma.payoutCycle.findUnique({ where: { id: cycleId } }) : null
  const event = await prisma.payoutEvent.create({
    data: {
      circleId,
      cycleId: cycleId ?? null,
      type,
      actorId,
      recipientId: recipientId ?? cycle?.recipientId ?? null,
      amount: cycle?.amount ?? null,
      metadata: (metadata as any) ?? undefined,
    },
  })
  return event
}
