import { prisma } from "@/lib/prisma"
import type { GovernanceVoteStatus, GovernanceVoteType, MotionCategory } from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import { getConstitutionRules, evaluateGovernanceVoteCompliance } from "@/lib/services/constitution-rules.service"
import { createApprovalRequest } from "@/lib/services/approval.service"

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function getVoteOrThrow(circleId: string, voteId: string) {
  const vote = await prisma.governanceVote.findUnique({ where: { id: voteId } })
  if (!vote || vote.circleId !== circleId) throw new Error("Vote not found")
  return vote
}

export type CreateVoteInput = {
  title: string
  description?: string
  motionCategory?: string
  type?: string
  meetingId?: string
  quorumPercent?: number
  thresholdPercent?: number
  anonymous?: boolean
  majorFinancial?: boolean
  closesAt?: string
  options?: string[]
}

/**
 * A single selection within a member's ballot. For RANKED_CHOICE every selection
 * carries a unique 1-based rank; for YES_NO / MULTIPLE_CHOICE ranks are omitted.
 */
export type VoteSelection = {
  optionId: string
  rank?: number
}

export async function createVote(circleId: string, userId: string, data: CreateVoteInput) {
  await validateMember(circleId, userId)
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })

  const rules = await getConstitutionRules(circleId).catch(() => null)
  const voting = rules?.voting

  const anonymous = data.anonymous ?? false
  if (anonymous && voting && voting.enabled && voting.anonymousVoteAllowed === false) {
    throw new Error("Anonymous voting is not permitted by the constitution")
  }

  const vType = (data.type || "YES_NO") as GovernanceVoteType
  const category = (data.motionCategory || "GENERAL_MOTION") as MotionCategory

  const options = data.options && data.options.length ? data.options : ["Yes", "No"]

  const vote = await prisma.governanceVote.create({
    data: {
      circleId,
      meetingId: data.meetingId || null,
      createdById: userId,
      title: data.title,
      description: data.description,
      motionCategory: category,
      type: vType,
      status: "OPEN",
      quorumPercent: data.quorumPercent ?? voting?.quorumPercent ?? null,
      thresholdPercent: data.thresholdPercent ?? voting?.thresholdPercent ?? null,
      anonymous,
      majorFinancial: data.majorFinancial ?? (category === "FINANCIAL" || category === "PAYOUT_EXCEPTION"),
      closesAt: data.closesAt ? new Date(data.closesAt) : null,
    },
  })

  for (let i = 0; i < options.length; i++) {
    await prisma.governanceVoteOption.create({
      data: { voteId: vote.id, text: options[i].trim(), sortOrder: i, createdById: userId },
    })
  }

  createAuditLog({ userId, circleId, action: "VOTE_OPENED", entityType: "GovernanceVote", entityId: vote.id, newValues: { title: vote.title, category, type: vType, anonymous } }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "VOTE_OPENED",
    title: `Vote opened: ${vote.title}`,
    message: "A new governance vote is now open",
    link: `/circles/${circleId}/meetings?highlight=vote`,
  }).catch(() => {})

  return vote
}

export async function getCircleVotes(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_VIEW })
  const votes = await prisma.governanceVote.findMany({
    where: { circleId },
    include: { options: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { votes: true } } } } },
    orderBy: { createdAt: "desc" },
  })
  return votes.map((v) => {
    const counts = optionCounts(v)
    return { ...v, resultCounts: counts }
  })
}

export async function getVote(circleId: string, voteId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_VIEW })
  const vote = await prisma.governanceVote.findUnique({
    where: { id: voteId, circleId },
    include: {
      options: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { votes: true } } } },
      createdBy: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true } },
    },
  })
  if (!vote) throw new Error("Vote not found")

  const [memberCount, myBallot, votesCast] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.governanceBallot.findUnique({
      where: { voteId_userId: { voteId, userId } },
      select: { records: { select: { optionId: true, rank: true } } },
    }),
    prisma.governanceBallot.count({ where: { voteId } }),
  ])

  const totalVotes = votesCast
  return {
    ...vote,
    memberCount,
    totalVotes,
    myVote: myBallot,
    // Anonymous: only aggregate counts are exposed, never individual voters.
    voterIdentities: vote.anonymous ? [] : vote.options,
    quorum: {
      memberCount,
      votesCast,
      quorumPercent: vote.quorumPercent,
      reached: vote.quorumPercent == null ? false : (votesCast / memberCount) * 100 >= vote.quorumPercent,
    },
  }
}

function optionCounts(vote: { options: { id: string; text: string; sortOrder: number; _count: { votes: number } }[] }) {
  return vote.options.map((o) => ({ optionId: o.id, text: o.text, count: o._count.votes }))
}

/**
 * Casts (or atomically replaces) a member's ballot for a governance vote.
 *
 * `selections` is a list of option picks. Validation enforced:
 *  - every option belongs to THIS vote (invalid / cross-vote options rejected)
 *  - no duplicate option IDs
 *  - ranks unique, positive integers, and required for RANKED_CHOICE
 *  - selection count matches the vote type (YES_NO == 1, MULTIPLE_CHOICE >= 1)
 *  - member is a circle member and vote is OPEN
 *  - one ballot per member: revoting while OPEN replaces the previous ballot
 *    atomically in a transaction (no partial multi-choice / ranked writes)
 */
export async function castVote(circleId: string, voteId: string, userId: string, selections: VoteSelection[]) {
  await validateMember(circleId, userId)
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE })
  const vote = await getVoteOrThrow(circleId, voteId)

  if (vote.status !== "OPEN") throw new Error("Vote is not open")
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("At least one selection is required")
  }

  // All options must belong to this vote (invalid & cross-vote options blocked).
  const options = await prisma.governanceVoteOption.findMany({ where: { voteId } })
  const optionIds = new Set(options.map((o) => o.id))
  const validOptions = selections.map((s) => s.optionId)
  for (const id of validOptions) {
    if (!optionIds.has(id)) throw new Error("Option not found for this vote")
  }

  // No duplicate option IDs.
  if (new Set(validOptions).size !== validOptions.length) {
    throw new Error("Each option may only be selected once")
  }

  const ranks = selections.filter((s) => s.rank != null).map((s) => s.rank as number)
  if (new Set(ranks).size !== ranks.length) {
    throw new Error("Ranks must be unique")
  }
  if (ranks.some((r) => !Number.isInteger(r) || r < 1)) {
    throw new Error("Ranks must be positive integers")
  }

  // Selection shape per vote type.
  switch (vote.type) {
    case "YES_NO":
      if (selections.length !== 1) throw new Error("YES_NO votes require exactly one selection")
      if (selections.some((s) => s.rank != null)) throw new Error("YES_NO selections must not include ranks")
      break
    case "MULTIPLE_CHOICE":
      if (selections.some((s) => s.rank != null)) throw new Error("MULTIPLE_CHOICE selections must not include ranks")
      break
    case "RANKED_CHOICE":
      if (selections.some((s) => s.rank == null)) throw new Error("RANKED_CHOICE requires every selection to have a rank")
      if (ranks.length !== selections.length) throw new Error("Every RANKED_CHOICE selection requires a unique rank")
      break
  }

  // One ballot per member; a prior ballot is replaced atomically (revote while OPEN).
  const existing = await prisma.governanceBallot.findUnique({ where: { voteId_userId: { voteId, userId } } })

  await prisma.$transaction(async (tx) => {
    let ballotId: string
    if (existing) {
      await tx.governanceVoteRecord.deleteMany({ where: { ballotId: existing.id } })
      ballotId = existing.id
      await tx.governanceBallot.update({ where: { id: existing.id }, data: { updatedAt: new Date() } })
    } else {
      const ballot = await tx.governanceBallot.create({ data: { voteId, userId } })
      ballotId = ballot.id
    }
    await tx.governanceVoteRecord.createMany({
      data: selections.map((s) => ({ ballotId, voteId, optionId: s.optionId, userId, rank: s.rank ?? null })),
    })
  })

  createAuditLog({ userId, circleId, action: "VOTE_CAST", entityType: "GovernanceVote", entityId: voteId, reason: "Ballot cast (identity protected when anonymous)" }).catch(() => {})

  return prisma.governanceBallot.findUnique({
    where: { voteId_userId: { voteId, userId } },
    include: { records: true },
  })
}

export async function closeVote(circleId: string, voteId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })
  const vote = await getVoteOrThrow(circleId, voteId)
  if (vote.status !== "OPEN") throw new Error("Vote is not open")
  const closed = await prisma.governanceVote.update({ where: { id: voteId }, data: { status: "CLOSED" } })
  createAuditLog({ userId, circleId, action: "VOTE_CLOSED", entityType: "GovernanceVote", entityId: voteId }).catch(() => {})
  return closed
}

export async function cancelVote(circleId: string, voteId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })
  const vote = await getVoteOrThrow(circleId, voteId)
  if (vote.status === "FINALIZED") throw new Error("Finalized votes cannot be cancelled")
  return prisma.governanceVote.update({ where: { id: voteId }, data: { status: "CANCELLED" } })
}

/**
 * Evaluates constitution thresholds and finalizes the result. Blocks finalization
 * when quorum is not met (voting must remain at CLOSED until quorum is reached).
 */
export async function finalizeVote(circleId: string, voteId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })
  const vote = await getVoteOrThrow(circleId, voteId)
  if (vote.status === "FINALIZED") return vote
  if (vote.status === "CANCELLED") throw new Error("Cancelled votes cannot be finalized")

  const [memberCount, votesCast, records, options] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.governanceBallot.count({ where: { voteId } }),
    prisma.governanceVoteRecord.findMany({ where: { voteId } }),
    prisma.governanceVoteOption.findMany({ where: { voteId }, orderBy: { sortOrder: "asc" } }),
  ])

  const totals: Record<string, number> = {}
  for (const o of options) totals[o.text] = 0
  for (const r of records) {
    const opt = options.find((o) => o.id === r.optionId)
    if (opt) totals[opt.text] = (totals[opt.text] || 0) + 1
  }

  const yesOption = vote.type === "YES_NO" ? options.find((o) => o.text.toLowerCase() === "yes") : null
  const votesFor = yesOption ? (totals[yesOption.text] || 0) : Math.max(0, ...Object.values(totals))

  const compliance = evaluateGovernanceVoteCompliance(
    { voting: (await getConstitutionRules(circleId)).voting },
    {
      totalMembers: memberCount,
      votesCast,
      votesFor,
      motionCategory: vote.motionCategory,
      isAnonymous: vote.anonymous,
    }
  )

  if (!compliance.quorumMet) {
    throw new Error("Quorum not met; governance vote cannot be finalized")
  }

  const passed = compliance.thresholdMet

  const result = {
    passed,
    outcome: passed ? "APPROVED" : "REJECTED",
    votesCast,
    totalMembers: memberCount,
    votesFor,
    totals,
    quorumPercent: compliance.quorumPercent,
    thresholdPercent: compliance.thresholdPercent,
    quorumMet: compliance.quorumMet,
    thresholdMet: compliance.thresholdMet,
    finalizedAt: new Date().toISOString(),
  }

  const finalized = await prisma.governanceVote.update({
    where: { id: voteId },
    data: { status: "FINALIZED", finalizedAt: new Date(), result: result },
  })

  createAuditLog({ userId, circleId, action: "GOV_DECISION_RECORDED", entityType: "GovernanceVote", entityId: voteId, newValues: result }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "VOTE_RESULT",
    title: `Vote result: ${passed ? "Approved" : "Rejected"} — ${vote.title}`,
    message: passed ? `The motion passed at ${compliance.thresholdPercent}%` : `The motion was rejected (threshold ${compliance.thresholdPercent}% not met)`,
    link: `/circles/${circleId}/meetings?highlight=vote`,
  }).catch(() => {})

  // Major financial decisions require the explicit approval flow in addition to the vote.
  if (vote.majorFinancial && passed) {
    await createApprovalRequest({
      circleId,
      type: "GOVERNANCE",
      resourceId: voteId,
      title: `Financial motion approved: ${vote.title}`,
      requestedById: userId,
      metadata: { motionCategory: vote.motionCategory, result },
      description: "A major financial decision requires formal approval",
    }).catch(() => {})
  }

  return finalized
}

export async function hasVotedSerially(circleId: string, voteId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_VIEW })
  const v = await prisma.governanceBallot.findUnique({ where: { voteId_userId: { voteId, userId } } })
  return !!v
}
