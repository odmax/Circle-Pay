import { prisma } from "@/lib/prisma"
import { recordContributionToLedger } from "@/lib/services/wallet.service"
import { addProjectActivity } from "@/lib/services/project.service"

// ─── Funding Round Lifecycle ────────────────────────────────

const VALID_ROUND_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSING", "CANCELLED"],
  CLOSING: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
}

function validateRoundTransition(current: string, next: string) {
  if (!VALID_ROUND_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`Cannot transition funding round from ${current} to ${next}`)
  }
}

export async function createFundingRound(
  projectId: string,
  userId: string,
  data: {
    name: string
    description?: string
    targetAmount: number
    allocationMethod?: "EQUAL" | "PERCENTAGE" | "CUSTOM" | "OPEN" | "HYBRID"
    minimumContribution?: number
    maximumContribution?: number
    allowOverfunding?: boolean
    overfundingTreatment?: "EXTRA_EQUITY" | "REPAYABLE_ADVANCE" | "SHORTFALL_COVER" | "DONATION" | "REQUIRE_SELECTION"
    opensAt?: Date
    closesAt?: Date
    dueDate?: Date
  }
) {
  if (data.targetAmount <= 0) throw new Error("Target amount must be greater than zero")
  if (data.minimumContribution && data.maximumContribution && data.minimumContribution > data.maximumContribution) {
    throw new Error("Minimum contribution cannot exceed maximum")
  }

  const round = await prisma.projectFundingRound.create({
    data: {
      projectId,
      createdById: userId,
      name: data.name,
      description: data.description || null,
      targetAmount: data.targetAmount,
      allocationMethod: data.allocationMethod || "EQUAL",
      minimumContribution: data.minimumContribution || null,
      maximumContribution: data.maximumContribution || null,
      allowOverfunding: data.allowOverfunding ?? false,
      overfundingTreatment: data.overfundingTreatment || "EXTRA_EQUITY",
      opensAt: data.opensAt || null,
      closesAt: data.closesAt || null,
      dueDate: data.dueDate || null,
    },
  })

  await addProjectActivity(projectId, userId, "funding_round_created", `Funding round "${round.name}" created`, `Target: R${Number(data.targetAmount).toLocaleString()}`)
  return round
}

export async function transitionFundingRound(roundId: string, nextStatus: string, userId: string) {
  const round = await prisma.projectFundingRound.findUnique({ where: { id: roundId }, include: { project: { select: { id: true } } } })
  if (!round) throw new Error("Funding round not found")
  validateRoundTransition(round.status, nextStatus)

  const updateData: Record<string, unknown> = { status: nextStatus }
  if (nextStatus === "OPEN") updateData.opensAt = new Date()
  if (nextStatus === "CLOSED") updateData.closedAt = new Date()
  if (nextStatus === "CLOSING") updateData.closesAt = new Date()

  const updated = await prisma.projectFundingRound.update({ where: { id: roundId }, data: updateData as any })

  const labels: Record<string, string> = {
    OPEN: "opened",
    CLOSING: "closing",
    CLOSED: "closed",
    CANCELLED: "cancelled",
  }
  await addProjectActivity(round.project.id, userId, `funding_round_${nextStatus.toLowerCase()}`, `Funding round "${round.name}" ${labels[nextStatus] || nextStatus.toLowerCase()}`)

  if (nextStatus === "OPEN") {
    await prisma.project.update({ where: { id: round.project.id }, data: { status: "FUNDING_OPEN" } })
  }

  return updated
}

// ─── Legacy API Compatibility ───────────────────────────────

export async function openFundingRound(roundId: string) {
  const round = await prisma.projectFundingRound.findUnique({ where: { id: roundId }, include: { project: { select: { id: true } } } })
  if (!round) throw new Error("Funding round not found")
  const updated = await prisma.projectFundingRound.update({ where: { id: roundId }, data: { status: "OPEN", opensAt: new Date() } })
  await addProjectActivity(round.project.id, null, "funding_round_opened", `Funding round "${round.name}" opened`)
  return updated
}

export async function closeFundingRound(roundId: string) {
  const round = await prisma.projectFundingRound.findUnique({ where: { id: roundId }, include: { project: { select: { id: true } } } })
  if (!round) throw new Error("Funding round not found")
  const updated = await prisma.projectFundingRound.update({ where: { id: roundId }, data: { status: "CLOSED", closesAt: new Date() } })
  await addProjectActivity(round.project.id, null, "funding_round_closed", `Funding round "${round.name}" closed`)
  return updated
}

export async function getProjectFunding(projectId: string) {
  const [rounds, contributions] = await Promise.all([
    prisma.projectFundingRound.findMany({ where: { projectId }, include: { createdBy: { select: { name: true } }, _count: { select: { contributions: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.projectContribution.findMany({ where: { projectId }, include: { user: { select: { id: true, name: true, email: true } }, confirmedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ])
  const confirmed = contributions.filter((c) => c.status === "CONFIRMED")
  const raised = confirmed.reduce((s, c) => s + Number(c.amount), 0)
  const totalTarget = rounds.filter((r) => r.status !== "CANCELLED").reduce((s, r) => s + Number(r.targetAmount), 0)
  return { rounds, contributions, summary: { raised, totalTarget, confirmedCount: confirmed.length, pendingCount: contributions.filter((c) => c.status === "PROOF_SUBMITTED").length } }
}

export async function createProjectContribution(projectId: string, userId: string, data: { amount: number; fundingRoundId?: string; reference?: string }) {
  const existing = await prisma.projectContribution.findFirst({ where: { projectId, userId, status: { not: "CANCELLED" } } })
  if (existing) throw new Error("You already have a pending contribution")
  return prisma.projectContribution.create({ data: { projectId, userId, fundingRoundId: data.fundingRoundId || null, amount: data.amount, proofReference: data.reference || null } })
}

export async function submitProjectContributionProof(contributionId: string, userId: string, reference: string) {
  const c = await prisma.projectContribution.findUnique({ where: { id: contributionId } })
  if (!c || c.userId !== userId) throw new Error("Not found")
  if (c.status !== "PENDING" && c.status !== "REJECTED") throw new Error("Invalid status")
  return prisma.projectContribution.update({ where: { id: contributionId }, data: { status: "PROOF_SUBMITTED", proofReference: reference } })
}

export async function confirmProjectContribution(contributionId: string, adminId: string) {
  const c = await prisma.projectContribution.findUnique({ where: { id: contributionId }, include: { project: true } })
  if (!c) throw new Error("Not found")
  if (c.status !== "PROOF_SUBMITTED") throw new Error("No proof submitted")
  const updated = await prisma.projectContribution.update({ where: { id: contributionId }, data: { status: "CONFIRMED", confirmedById: adminId, confirmedAt: new Date() } })
  await prisma.project.update({ where: { id: c.projectId }, data: { currentAmount: { increment: Number(c.amount) } } })
  if (c.fundingRoundId) await prisma.projectFundingRound.update({ where: { id: c.fundingRoundId }, data: { currentAmount: { increment: Number(c.amount) } } })
  await addProjectActivity(c.projectId, adminId, "contribution_confirmed", `Contribution of R${Number(c.amount).toLocaleString()} confirmed`)
  recordContributionToLedger(c.project.circleId, `project-contribution:${c.id}`, Number(c.amount), c.userId).catch(() => {})
  return updated
}

export async function rejectProjectContribution(contributionId: string, adminId: string, reason?: string) {
  const c = await prisma.projectContribution.findUnique({ where: { id: contributionId } })
  if (!c) throw new Error("Not found")
  if (c.status !== "PROOF_SUBMITTED") throw new Error("No proof submitted")
  return prisma.projectContribution.update({ where: { id: contributionId }, data: { status: "REJECTED", rejectedById: adminId, rejectedAt: new Date(), rejectionReason: reason || null } })
}

// ─── Allocation Engine ──────────────────────────────────────

export async function generateEqualAllocations(fundingRoundId: string, userId: string) {
  const round = await prisma.projectFundingRound.findUnique({
    where: { id: fundingRoundId },
    include: { project: { select: { id: true, circleId: true } } },
  })
  if (!round) throw new Error("Funding round not found")
  if (round.status !== "DRAFT" && round.status !== "OPEN") throw new Error("Round must be DRAFT or OPEN")

  const members = await prisma.circleMember.findMany({
    where: { circleId: round.project.circleId },
    include: { user: { select: { id: true } } },
  })
  if (members.length === 0) throw new Error("No eligible members found")

  await prisma.projectFundingAllocation.deleteMany({ where: { fundingRoundId } })

  const targetAmount = Number(round.targetAmount)
  const memberCount = members.length
  const baseAllocation = Math.floor(targetAmount / memberCount * 100) / 100
  const remainder = Math.round((targetAmount - baseAllocation * memberCount) * 100) / 100

  const allocations = []
  for (let i = 0; i < members.length; i++) {
    const member = members[i]
    const participant = await upsertCircleMemberParticipant(round.project.id, member.user.id)

    const amount = i === members.length - 1 ? Math.round((baseAllocation + remainder) * 100) / 100 : baseAllocation

    const allocation = await prisma.projectFundingAllocation.create({
      data: {
        fundingRoundId,
        projectId: round.project.id,
        participantId: participant.id,
        allocatedAmount: amount,
        dueDate: round.dueDate || null,
        status: "PENDING",
        generatedBy: "SYSTEM",
      },
    })
    allocations.push(allocation)
  }

  await addProjectActivity(round.project.id, userId, "allocations_generated", `Generated ${allocations.length} equal allocations`, `R${targetAmount.toLocaleString()} divided among ${memberCount} members`)

  return allocations
}

export async function adjustAllocation(allocationId: string, userId: string, data: { allocatedAmount: number; reason: string }) {
  if (data.allocatedAmount <= 0) throw new Error("Allocated amount must be greater than zero")
  if (!data.reason) throw new Error("Adjustment reason is required")

  const allocation = await prisma.projectFundingAllocation.findUnique({ where: { id: allocationId } })
  if (!allocation) throw new Error("Allocation not found")
  if (allocation.status === "PAID" || allocation.status === "CANCELLED") {
    throw new Error("Cannot adjust a paid or cancelled allocation")
  }

  const updated = await prisma.projectFundingAllocation.update({
    where: { id: allocationId },
    data: { allocatedAmount: data.allocatedAmount, adjustedBy: userId, adjustmentReason: data.reason },
  })

  await addProjectActivity(allocation.projectId, userId, "allocation_adjusted", `Allocation adjusted to R${data.allocatedAmount.toLocaleString()}`, data.reason)
  return updated
}

export async function getProjectFundingOverview(projectId: string) {
  const [rounds, allocations, commitments, capitalTxs] = await Promise.all([
    prisma.projectFundingRound.findMany({
      where: { projectId },
      include: { createdBy: { select: { name: true } }, _count: { select: { allocations: true, commitments: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectFundingAllocation.findMany({
      where: { projectId },
      include: { participant: { include: { user: { select: { id: true, name: true, email: true } } } }, fundingRound: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectFundingCommitment.findMany({
      where: { projectId },
      include: { participant: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectCapitalTransaction.findMany({
      where: { projectId, status: "CONFIRMED" },
      select: { classification: true, amount: true, ownershipEligibleAmount: true, profitEligibleAmount: true },
    }),
  ])

  const totalAllocated = allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0)
  const totalCommitted = allocations.reduce((s, a) => s + Number(a.committedAmount), 0)
  const totalPaid = allocations.reduce((s, a) => s + Number(a.paidAmount), 0)
  const totalShortfall = allocations.reduce((s, a) => s + Number(a.shortfallAmount), 0)
  const totalExcess = allocations.reduce((s, a) => s + Number(a.excessAmount), 0)
  const totalTarget = rounds.filter((r) => r.status !== "CANCELLED").reduce((s, r) => s + Number(r.targetAmount), 0)

  const confirmedCapital = capitalTxs.filter((t) => t.classification === "REQUIRED_EQUITY").reduce((s, t) => s + Number(t.amount), 0)
  const extraCapital = capitalTxs.filter((t) => t.classification === "EXTRA_EQUITY").reduce((s, t) => s + Number(t.amount), 0)
  const externalCapital = capitalTxs.filter((t) => t.classification === "EXTERNAL_INVESTMENT").reduce((s, t) => s + Number(t.amount), 0)
  const donationCapital = capitalTxs.filter((t) => t.classification === "DONATION").reduce((s, t) => s + Number(t.amount), 0)

  return {
    rounds, allocations, commitments,
    summary: {
      totalTarget, totalAllocated, totalCommitted, totalPaid, totalShortfall, totalExcess,
      fundingPercentage: totalTarget > 0 ? (totalPaid / totalTarget) * 100 : 0,
      confirmedCapital, extraCapital, externalCapital, donationCapital,
    },
  }
}

// ─── Commitments ────────────────────────────────────────────

export async function createCommitment(fundingRoundId: string, participantId: string, data: {
  amount: number
  classification?: "REQUIRED_EQUITY" | "EXTRA_EQUITY" | "SHORTFALL_COVER_EQUITY" | "MEMBER_ADVANCE" | "EXTERNAL_INVESTMENT" | "LOAN" | "DONATION" | "SPONSORSHIP"
  expectedReturn?: number
  repaymentTerms?: string
  ownershipImpact?: boolean
  dueDate?: Date
}) {
  if (data.amount <= 0) throw new Error("Commitment amount must be greater than zero")

  const round = await prisma.projectFundingRound.findUnique({ where: { id: fundingRoundId }, select: { projectId: true, status: true } })
  if (!round) throw new Error("Funding round not found")
  if (round.status === "CANCELLED") throw new Error("Cannot commit to a cancelled round")

  const commitment = await prisma.projectFundingCommitment.create({
    data: {
      fundingRoundId,
      projectId: round.projectId,
      participantId,
      amount: data.amount,
      classification: data.classification || "REQUIRED_EQUITY",
      expectedReturn: data.expectedReturn || null,
      repaymentTerms: data.repaymentTerms || null,
      ownershipImpact: data.ownershipImpact ?? false,
      dueDate: data.dueDate || null,
      status: "PENDING",
    },
  })

  const allocation = await prisma.projectFundingAllocation.findFirst({ where: { fundingRoundId, participantId } })
  if (allocation) {
    await prisma.projectFundingAllocation.update({
      where: { id: allocation.id },
      data: { committedAmount: { increment: data.amount }, status: "COMMITTED" },
    })
  }

  await addProjectActivity(round.projectId, null, "commitment_created", `Commitment of R${data.amount.toLocaleString()} created`, `Classification: ${data.classification}`)
  return commitment
}

export async function approveCommitment(commitmentId: string, adminId: string) {
  const commitment = await prisma.projectFundingCommitment.findUnique({ where: { id: commitmentId } })
  if (!commitment) throw new Error("Commitment not found")
  if (commitment.status !== "PENDING") throw new Error("Commitment is not pending")
  return prisma.projectFundingCommitment.update({ where: { id: commitmentId }, data: { status: "CONFIRMED", approvalStatus: "APPROVED" } })
}

export async function cancelCommitment(commitmentId: string, userId: string, reason?: string) {
  const commitment = await prisma.projectFundingCommitment.findUnique({ where: { id: commitmentId } })
  if (!commitment) throw new Error("Commitment not found")
  if (commitment.status === "CONFIRMED") throw new Error("Cannot cancel a confirmed commitment")

  const updated = await prisma.projectFundingCommitment.update({
    where: { id: commitmentId },
    data: { status: "CANCELLED", cancellationReason: reason || null },
  })

  const allocation = await prisma.projectFundingAllocation.findFirst({ where: { fundingRoundId: commitment.fundingRoundId, participantId: commitment.participantId } })
  if (allocation) {
    await prisma.projectFundingAllocation.update({ where: { id: allocation.id }, data: { committedAmount: { decrement: commitment.amount } } })
  }

  return updated
}

// ─── Participant Management ─────────────────────────────────

async function upsertCircleMemberParticipant(projectId: string, userId: string) {
  const existing = await prisma.projectParticipant.findFirst({ where: { projectId, userId } })
  if (existing) return existing

  return prisma.projectParticipant.create({
    data: { projectId, userId, type: "CIRCLE_MEMBER", status: "ACCEPTED", joinedAt: new Date() },
  })
}

export async function addExternalParticipant(projectId: string, data: {
  name: string
  email?: string
  phone?: string
  type: "EXTERNAL_INVESTOR" | "DONOR" | "LENDER" | "SPONSOR" | "PARTNER"
  votingEligible?: boolean
  distributionEligible?: boolean
}) {
  if (!data.name) throw new Error("Participant name is required")
  return prisma.projectParticipant.create({
    data: {
      projectId, externalName: data.name, externalEmail: data.email || null, externalPhone: data.phone || null,
      type: data.type, status: "INVITED", votingEligible: data.votingEligible ?? false, distributionEligible: data.distributionEligible ?? true,
    },
  })
}

export async function acceptParticipant(participantId: string) {
  return prisma.projectParticipant.update({ where: { id: participantId }, data: { status: "ACCEPTED", joinedAt: new Date() } })
}

export async function removeParticipant(participantId: string) {
  const participant = await prisma.projectParticipant.findUnique({ where: { id: participantId } })
  if (!participant) throw new Error("Participant not found")
  if (participant.type === "CIRCLE_MEMBER") throw new Error("Cannot remove a circle member participant directly")
  return prisma.projectParticipant.update({ where: { id: participantId }, data: { status: "REMOVED" } })
}

export async function getProjectParticipants(projectId: string) {
  return prisma.projectParticipant.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      allocations: { include: { fundingRound: { select: { name: true } } } },
      commitments: { select: { amount: true, classification: true, status: true } },
      capitalTransactions: { select: { amount: true, classification: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  })
}
