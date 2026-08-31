/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { addProjectActivity } from "@/lib/services/project.service"
import { slugifyOpportunity, getMyOpportunities as getMyOpportunitiesPure } from "@/lib/services/project-investment-metrics"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const slugify = slugifyOpportunity
export const getMyOpportunities = getMyOpportunitiesPure

export interface OpportunityCommitmentView {
  id: string
  userId: string
  amount: number
  status: string
  proofUrl: string | null
  proofReference: string | null
  createdAt: string
  userName: string | null
}

export interface OpportunitySummary {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  targetAmount: number
  raised: number
  fundingPercent: number
  minimumInvestment: number | null
  maximumInvestment: number | null
  expectedReturn: number | null
  expectedDuration: string | null
  riskLevel: string
  coverImage: string | null
  openDate: string | null
  closingDate: string | null
  requiresApproval: boolean
  requiresVote: boolean
  investors: number
  projectId: string | null
  createdByName: string | null
  myCommitted: number
  myConfirmed: number
  myPending: number
}

async function opportunityInCircle(circleId: string, opportunityId: string) {
  const opp = await prisma.investmentOpportunity.findFirst({ where: { id: opportunityId, circleId }, include: { createdBy: { select: { name: true } } } })
  if (!opp) throw new Error("Opportunity not found")
  return opp
}

function toSummary(opp: any, rows: any[]): OpportunitySummary {
  const confirmed = rows.filter((r) => r.status === "CONFIRMED")
  const raised = confirmed.reduce((s, r) => s + asNum(r.amount), 0)
  const target = asNum(opp.targetAmount)
  const investors = new Set(confirmed.map((r) => r.userId)).size
  const mine = rows.filter((r) => r.userId === opp._viewerId)
  return {
    id: opp.id,
    title: opp.title,
    description: opp.description,
    type: opp.type,
    status: opp.status,
    targetAmount: target,
    raised,
    fundingPercent: target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0,
    minimumInvestment: opp.minimumInvestment != null ? asNum(opp.minimumInvestment) : null,
    maximumInvestment: opp.maximumInvestment != null ? asNum(opp.maximumInvestment) : null,
    expectedReturn: opp.expectedReturn != null ? asNum(opp.expectedReturn) : null,
    expectedDuration: opp.expectedDuration,
    riskLevel: opp.riskLevel,
    coverImage: opp.coverImage,
    openDate: opp.openDate ? opp.openDate.toISOString() : null,
    closingDate: opp.closingDate ? opp.closingDate.toISOString() : null,
    requiresApproval: opp.requiresApproval,
    requiresVote: opp.requiresVote,
    investors,
    projectId: opp.projectId,
    createdByName: opp.createdBy?.name ?? null,
    myCommitted: mine.filter((r) => ["PENDING", "PAID", "CONFIRMED"].includes(r.status)).reduce((s, r) => s + asNum(r.amount), 0),
    myConfirmed: mine.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + asNum(r.amount), 0),
    myPending: mine.filter((r) => ["PENDING", "PAID"].includes(r.status)).reduce((s, r) => s + asNum(r.amount), 0),
  }
}

export async function listOpportunities(circleId: string, viewerUserId: string) {
  const [opps, rows] = await Promise.all([
    prisma.investmentOpportunity.findMany({
      where: { circleId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.investmentOpportunityCommitment.findMany({
      where: { opportunity: { circleId } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])
  const byOpp = new Map<string, typeof rows>()
  for (const r of rows) {
    const arr = byOpp.get(r.opportunityId) || []
    arr.push(r)
    byOpp.set(r.opportunityId, arr)
  }
  const opportunities = opps.map((o) => ({ ...o, _viewerId: viewerUserId } as any)).map((o) => toSummary(o, byOpp.get(o.id) || []))
  const myOpportunities = getMyOpportunities(opportunities)
  return { opportunities, myOpportunities }
}

export async function getOpportunityDetail(circleId: string, opportunityId: string, viewerUserId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  const commitments = await prisma.investmentOpportunityCommitment.findMany({ where: { opportunityId }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } })
  const documents = await prisma.investmentOpportunityDocument.findMany({ where: { opportunityId }, orderBy: { createdAt: "desc" } })
  const summary = toSummary({ ...opp, _viewerId: viewerUserId }, commitments)
  return { opportunity: summary, documents, commitments: commitments.map((c) => ({ id: c.id, userId: c.userId, amount: asNum(c.amount), status: c.status, proofUrl: c.proofUrl, proofReference: c.proofReference, createdAt: c.createdAt.toISOString(), userName: c.user?.name ?? null })) }
}

export async function createOpportunity(circleId: string, userId: string, data: {
  title: string
  description?: string
  type?: string
  targetAmount: number
  minimumInvestment?: number
  maximumInvestment?: number
  openDate?: string | null
  closingDate?: string | null
  expectedReturn?: number
  expectedDuration?: string
  riskLevel?: string
  coverImage?: string
  requiresApproval?: boolean
  requiresVote?: boolean
}) {
  const title = (data.title || "").trim()
  if (!title) throw new Error("Title is required")
  if (!data.targetAmount || data.targetAmount <= 0) throw new Error("Target amount must be greater than zero")
  if (data.minimumInvestment && data.maximumInvestment && data.minimumInvestment > data.maximumInvestment) throw new Error("Minimum cannot exceed maximum")
  if (data.closingDate && data.openDate && new Date(data.closingDate) < new Date(data.openDate)) throw new Error("Closing date must be after open date")

  const opp = await prisma.investmentOpportunity.create({
    data: {
      circleId, createdById: userId,
      title,
      description: data.description ?? null,
      type: data.type || "general",
      targetAmount: data.targetAmount,
      minimumInvestment: data.minimumInvestment ?? null,
      maximumInvestment: data.maximumInvestment ?? null,
      openDate: data.openDate ? new Date(data.openDate) : null,
      closingDate: data.closingDate ? new Date(data.closingDate) : null,
      expectedReturn: data.expectedReturn ?? null,
      expectedDuration: data.expectedDuration ?? null,
      riskLevel: data.riskLevel || "MEDIUM",
      coverImage: data.coverImage ?? null,
      requiresApproval: data.requiresApproval ?? false,
      requiresVote: data.requiresVote ?? false,
    },
  })

  // Reuse the governance voting engine when a member vote is required before opening.
  if (opp.requiresVote) {
    await prisma.governanceVote.create({
      data: {
        circleId,
        createdById: userId,
        title: `Opportunity vote: ${opp.title}`,
        description: `opportunity:${opp.id}`,
        motionCategory: "GENERAL_MOTION",
        type: "YES_NO",
        status: "OPEN",
        majorFinancial: true,
      },
    }).catch(() => {})
  }

  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_CREATED", entityType: "InvestmentOpportunity", entityId: opp.id, newValues: { title, target: data.targetAmount } })
  return opp
}

export async function updateOpportunity(circleId: string, opportunityId: string, userId: string, data: Record<string, unknown>) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (opp.status !== "DRAFT" && opp.status !== "OPEN") throw new Error("Only DRAFT or OPEN opportunities can be edited")
  const allowed = ["title", "description", "type", "targetAmount", "minimumInvestment", "maximumInvestment", "openDate", "closingDate", "expectedReturn", "expectedDuration", "riskLevel", "coverImage", "requiresApproval", "requiresVote"]
  const safe: Record<string, unknown> = {}
  for (const k of allowed) if (data[k] !== undefined) safe[k] = data[k]
  if (safe.minimumInvestment && safe.maximumInvestment && Number(safe.minimumInvestment) > Number(safe.maximumInvestment)) throw new Error("Minimum cannot exceed maximum")
  const updated = await prisma.investmentOpportunity.update({ where: { id: opportunityId }, data: safe as any })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_UPDATED", entityType: "InvestmentOpportunity", entityId: opportunityId, newValues: safe })
  return updated
}

async function notifyOpportunityMembers(circleId: string, opportunityId: string, type: any, title: string, message: string) {
  const { notifyCircleMembers } = await import("@/lib/services/notification.service")
  await notifyCircleMembers(circleId, null, { type, title, message, link: `/circles/${circleId}/opportunities/${opportunityId}` }).catch(() => {})
}

async function notifyOpportunityApprovers(circleId: string, type: any, title: string, message: string, link: string) {
  const { createNotification } = await import("@/lib/services/notification.service")
  const admins = await prisma.circleMember.findMany({
    where: { circleId, role: { in: ["OWNER", "ADMIN", "TREASURER"] } },
    select: { userId: true },
  })
  for (const m of admins) {
    await createNotification({ userId: m.userId, circleId, type, title, message, link }).catch(() => {})
  }
}

export async function approveOpportunity(circleId: string, opportunityId: string, approverId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (!opp.requiresApproval) throw new Error("This opportunity does not require approval")
  if (opp.status !== "DRAFT") throw new Error("Only DRAFT opportunities can be approved")
  // No self-approval — the approver must be a different user than the creator.
  if (opp.createdById === approverId) throw new Error("You cannot approve your own opportunity")
  const updated = await prisma.investmentOpportunity.update({ where: { id: opportunityId }, data: { approvedById: approverId, approvedAt: new Date() } })
  await createAuditLog({ userId: approverId, circleId, action: "OPPORTUNITY_APPROVED", entityType: "InvestmentOpportunity", entityId: opportunityId })
  return updated
}

export async function recordOpportunityVotePassed(circleId: string, opportunityId: string, userId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (!opp.requiresVote) throw new Error("This opportunity does not require a vote")
  const vote = await prisma.governanceVote.findFirst({ where: { circleId, status: { in: ["OPEN", "FINALIZED"] }, description: `opportunity:${opportunityId}` } })
  if (!vote) throw new Error("No governance vote found for this opportunity")
  if (vote.status !== "FINALIZED") {
    await prisma.governanceVote.update({ where: { id: vote.id }, data: { status: "FINALIZED", finalizedAt: new Date(), result: { opportunityId, passed: true } } })
  }
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_VOTE_PASSED", entityType: "InvestmentOpportunity", entityId: opportunityId })
  return { ok: true }
}

export async function openOpportunity(circleId: string, opportunityId: string, userId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (opp.status !== "DRAFT") throw new Error("Only DRAFT opportunities can be opened")

  if (opp.requiresApproval && !opp.approvedById) throw new Error("Approval required before this opportunity can open")
  if (opp.requiresApproval && opp.approvedById === opp.createdById) throw new Error("Approval separation violation")

  if (opp.requiresVote) {
    const vote = await prisma.governanceVote.findFirst({ where: { circleId, status: "FINALIZED", description: `opportunity:${opportunityId}` } })
    const passed = vote?.result && (vote.result as any).passed === true
    if (!passed) throw new Error("A passed member vote is required before this opportunity can open")
  }

  const updated = await prisma.investmentOpportunity.update({
    where: { id: opportunityId },
    data: { status: "OPEN", openedById: userId, openedAt: new Date(), openDate: opp.openDate || new Date() },
  })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_OPENED", entityType: "InvestmentOpportunity", entityId: opportunityId })
  await notifyOpportunityMembers(circleId, opportunityId, "OPPORTUNITY_OPENED", `${opp.title} is now open for investment`, `Target ${asNum(opp.targetAmount).toLocaleString()} · closing ${opp.closingDate ? new Date(opp.closingDate).toDateString() : "soon"}.`)
  return updated
}

export async function closeOpportunity(circleId: string, opportunityId: string, userId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (opp.status === "FUNDED" || opp.status === "CANCELLED") throw new Error("Cannot close a funded or cancelled opportunity")
  const updated = await prisma.investmentOpportunity.update({ where: { id: opportunityId }, data: { status: "CLOSED", closedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_CLOSED", entityType: "InvestmentOpportunity", entityId: opportunityId })
  return updated
}

export async function cancelOpportunity(circleId: string, opportunityId: string, userId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (opp.status === "FUNDED" || opp.status === "CLOSED") throw new Error("Cannot cancel a funded or closed opportunity")
  const updated = await prisma.investmentOpportunity.update({ where: { id: opportunityId }, data: { status: "CANCELLED", cancelledAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_CANCELLED", entityType: "InvestmentOpportunity", entityId: opportunityId })
  await notifyOpportunityMembers(circleId, opportunityId, "OPPORTUNITY_CANCELLED", `${opp.title} was cancelled`, "Any unpaid commitments can be withdrawn.")
  return updated
}

export async function commitToOpportunity(circleId: string, opportunityId: string, userId: string, amount: number) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (opp.status !== "OPEN") throw new Error("This opportunity is not open for commitments")
  if (opp.closingDate && new Date(opp.closingDate) < new Date()) throw new Error("This opportunity has closed")
  if (amount <= 0) throw new Error("Amount must be greater than zero")
  const min = opp.minimumInvestment != null ? asNum(opp.minimumInvestment) : 0
  if (amount < min) throw new Error(`Minimum commitment is ${min.toLocaleString()}`)
  if (opp.maximumInvestment != null && amount > asNum(opp.maximumInvestment)) throw new Error(`Maximum commitment is ${asNum(opp.maximumInvestment).toLocaleString()}`)

  const mine = await prisma.investmentOpportunityCommitment.aggregate({
    where: { opportunityId, userId, status: { in: ["PENDING", "PAID", "CONFIRMED"] } },
    _sum: { amount: true },
  })
  const existing = asNum(mine._sum.amount)
  if (existing + amount > asNum(opp.targetAmount)) throw new Error("Commitment would exceed the funding target")

  const commitment = await prisma.investmentOpportunityCommitment.create({
    data: { opportunityId, userId, amount, status: "PENDING" },
  })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_COMMITMENT_RECEIVED", entityType: "InvestmentOpportunityCommitment", entityId: commitment.id, reason: `Amount ${amount.toLocaleString()}` })
  await notifyOpportunityApprovers(circleId, "COMMITMENT_RECEIVED", `New commitment on ${opp.title}`, `${amount.toLocaleString()} committed — awaiting proof.`, `/circles/${circleId}/opportunities/${opportunityId}`)
  return commitment
}

export async function submitOpportunityProof(circleId: string, commitmentId: string, userId: string, props: { proofUrl?: string; reference?: string }) {
  const c = await prisma.investmentOpportunityCommitment.findUnique({ where: { id: commitmentId } })
  if (!c || c.userId !== userId) throw new Error("Not found")
  if (c.status !== "PENDING" && c.status !== "REJECTED") throw new Error("Invalid status")
  const opp = await opportunityInCircle(circleId, c.opportunityId)
  const updated = await prisma.investmentOpportunityCommitment.update({
    where: { id: commitmentId },
    data: { status: "PAID", proofUrl: props.proofUrl || c.proofUrl, proofReference: props.reference || c.proofReference, proofSubmittedAt: new Date() },
  })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_PROOF_SUBMITTED", entityType: "InvestmentOpportunityCommitment", entityId: commitmentId })
  await notifyOpportunityApprovers(circleId, "PROOF_REQUIRES_REVIEW", `Proof submitted on ${opp.title}`, `A ${asNum(c.amount).toLocaleString()} commitment needs review.`, `/circles/${circleId}/opportunities/${opp.id}`)
  return updated
}

async function maybeFundOpportunity(circleId: string, opp: { id: string; title: string; targetAmount: unknown }) {
  const confirmed = await prisma.investmentOpportunityCommitment.aggregate({
    where: { opportunityId: opp.id, status: "CONFIRMED" },
    _sum: { amount: true },
  })
  if (asNum(confirmed._sum.amount) >= asNum(opp.targetAmount)) {
    await prisma.investmentOpportunity.update({ where: { id: opp.id }, data: { status: "FUNDED", fundedAt: new Date() } })
    await notifyOpportunityMembers(circleId, opp.id, "OPPORTUNITY_FUNDED", `${opp.title} reached its funding target`, "Pending conversion into a funded project.")
  }
}

export async function approveCommitment(circleId: string, commitmentId: string, adminId: string) {
  const c = await prisma.investmentOpportunityCommitment.findUnique({ where: { id: commitmentId }, include: { opportunity: { select: { id: true, circleId: true, title: true, targetAmount: true } } } })
  if (!c || c.opportunity.circleId !== circleId) throw new Error("Not found")
  if (c.status !== "PAID") throw new Error("Only paid commitments can be confirmed")
  // No self-approval of your own investment.
  if (c.userId === adminId) throw new Error("You cannot approve your own commitment")
  const updated = await prisma.investmentOpportunityCommitment.update({
    where: { id: commitmentId },
    data: { status: "CONFIRMED", confirmedById: adminId, confirmedAt: new Date() },
  })
  await createAuditLog({ userId: adminId, circleId, action: "OPPORTUNITY_COMMITMENT_CONFIRMED", entityType: "InvestmentOpportunityCommitment", entityId: commitmentId })
  await notifyOpportunityMembers(circleId, c.opportunity.id, "COMMITMENT_CONFIRMED", `Your commitment on ${c.opportunity.title} was confirmed`, `${asNum(c.amount).toLocaleString()} confirmed.`)
  await maybeFundOpportunity(circleId, c.opportunity)
  return updated
}

export async function rejectCommitment(circleId: string, commitmentId: string, adminId: string, reason?: string) {
  const c = await prisma.investmentOpportunityCommitment.findUnique({ where: { id: commitmentId }, include: { opportunity: { select: { id: true, circleId: true, title: true } } } })
  if (!c || c.opportunity.circleId !== circleId) throw new Error("Not found")
  if (c.status !== "PAID") throw new Error("Only paid commitments can be rejected")
  if (c.userId === adminId) throw new Error("You cannot reject your own commitment")
  const updated = await prisma.investmentOpportunityCommitment.update({
    where: { id: commitmentId },
    data: { status: "REJECTED", rejectedById: adminId, rejectedAt: new Date(), rejectionReason: reason || null },
  })
  await createAuditLog({ userId: adminId, circleId, action: "OPPORTUNITY_COMMITMENT_REJECTED", entityType: "InvestmentOpportunityCommitment", entityId: commitmentId, reason: reason || null })
  await notifyOpportunityMembers(circleId, c.opportunity.id, "COMMITMENT_REJECTED", `Your commitment on ${c.opportunity.title} was rejected`, reason ? `Reason: ${reason}` : "Please contact management.")
  return updated
}

export async function withdrawCommitment(circleId: string, commitmentId: string, userId: string) {
  const c = await prisma.investmentOpportunityCommitment.findUnique({ where: { id: commitmentId } })
  if (!c || c.userId !== userId) throw new Error("Not found")
  if (c.status !== "PENDING" && c.status !== "PAID") throw new Error("Only unpaid commitments can be withdrawn")
  const updated = await prisma.investmentOpportunityCommitment.update({ where: { id: commitmentId }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_COMMITMENT_WITHDRAWN", entityType: "InvestmentOpportunityCommitment", entityId: commitmentId })
  return updated
}

export async function addOpportunityDocument(circleId: string, opportunityId: string, userId: string, data: { name: string; url: string; mimeType?: string; size?: number }) {
  await opportunityInCircle(circleId, opportunityId)
  const doc = await prisma.investmentOpportunityDocument.create({
    data: { opportunityId, uploadedById: userId, name: data.name, url: data.url, mimeType: data.mimeType ?? null, size: data.size ?? null },
  })
  await createAuditLog({ userId, circleId, action: "OPPORTUNITY_DOCUMENT_ADDED", entityType: "InvestmentOpportunityDocument", entityId: doc.id, newValues: { name: data.name } })
  return doc
}

export async function sweepOpportunityReminders(circleId: string) {
  const { createNotification } = await import("@/lib/services/notification.service")
  const results: string[] = []
  const opps = await prisma.investmentOpportunity.findMany({ where: { circleId, status: "OPEN", closingDate: { not: null } } })
  for (const opp of opps) {
    const closing = opp.closingDate ? new Date(opp.closingDate) : null
    if (!closing) continue
    const hours = (closing.getTime() - Date.now()) / 3600000
    const closingSoon = hours >= 0 && hours <= 72
    const flagged = (opp.metadata as any)?.notifiedClosingSoon === true
    if (closingSoon && !flagged) {
      await prisma.investmentOpportunity.update({ where: { id: opp.id }, data: { metadata: { ...(opp.metadata as any || {}), notifiedClosingSoon: true } } })
      const members = await prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } })
      for (const m of members) {
        await createNotification({
          userId: m.userId,
          circleId,
          type: "OPPORTUNITY_CLOSING_SOON",
          title: `Closing soon: ${opp.title}`,
          message: `This opportunity closes on ${closing.toDateString()}.`,
          link: `/circles/${circleId}/opportunities/${opp.id}`,
        }).catch(() => {})
      }
      results.push(`notified:${opp.id}:closing-soon`)
    }
  }
  return results
}

export async function getOpportunityDashboardSnapshot(circleId: string, viewerUserId: string) {
  const { listCapitalCalls } = await import("@/lib/services/capital-call.service")
  const [opps, calls] = await Promise.all([
    listOpportunities(circleId, viewerUserId),
    listCapitalCalls(circleId, viewerUserId),
  ])
  const openOpps = opps.opportunities.filter((o) => o.status === "OPEN")
  const openCalls = calls.calls.filter((c) => c.status === "OPEN")
  return {
    openOpportunities: openOpps.length,
    capitalBeingRaised: Math.round((openOpps.reduce((s, o) => s + o.targetAmount, 0) + openCalls.reduce((s, c) => s + c.amountRequired, 0)) * 100) / 100,
    myOutstandingCalls: calls.myOutstandingCalls,
    closingSoon: openOpps.filter((o) => o.closingDate && new Date(o.closingDate).getTime() - Date.now() < 7 * 86400000).length,
    recentlyFunded: opps.opportunities.filter((o) => o.status === "FUNDED").length,
  }
}

// ─── Funding Conversion (Opportunity → Project → Round → Confirmed Capital) ───

export async function convertOpportunityToProject(circleId: string, opportunityId: string, actorUserId: string) {
  const opp = await opportunityInCircle(circleId, opportunityId)
  if (opp.status === "CANCELLED") throw new Error("Cancelled opportunities cannot be converted")

  if (opp.projectId) {
    const project = await prisma.project.findUnique({ where: { id: opp.projectId } })
    if (project) return { project, reusable: true }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.investmentOpportunity.findUnique({ where: { id: opportunityId }, include: { commitments: true } })
      if (!current) throw new Error("Opportunity not found")
      if (current.projectId) {
        const existing = await tx.project.findUnique({ where: { id: current.projectId } })
        if (existing) return { project: existing, reusable: true }
      }

      const confirmed = current.commitments.filter((c) => c.status === "CONFIRMED")
      const confirmedTotal = Math.round(confirmed.reduce((s, c) => s + asNum(c.amount), 0) * 100) / 100
      const target = asNum(current.targetAmount)
      if (confirmedTotal < target) throw new Error(`Opportunity must be fully funded before conversion (${confirmedTotal.toLocaleString()} of ${target.toLocaleString()})`)

      const slug = slugify(current.title)
      const project = await tx.project.create({
        data: {
          circleId,
          createdById: actorUserId,
          name: current.title,
          slug,
          description: current.description,
          type: current.type || "general",
          status: "FULLY_FUNDED",
          targetAmount: target,
          currentAmount: confirmedTotal,
          visibility: "MEMBERS_ONLY",
        },
      })

      const round = await tx.projectFundingRound.create({
        data: {
          projectId: project.id,
          createdById: actorUserId,
          name: `Primary raise — ${current.title}`,
          description: "Converted from an investment opportunity",
          targetAmount: target,
          currentAmount: confirmedTotal,
          status: "CLOSED",
          allocationMethod: "OPEN",
          allowOverfunding: false,
          closedAt: current.closedAt || new Date(),
        },
      })

      // Confirmed member capital → confirmed project contributions → ownership.
      for (const c of confirmed) {
        const dup = await tx.projectContribution.findFirst({
          where: { metadata: { path: ["opportunityCommitmentId"], equals: c.id } },
        })
        if (dup) continue
        await tx.projectContribution.create({
          data: {
            projectId: project.id,
            fundingRoundId: round.id,
            userId: c.userId,
            amount: c.amount,
            currency: "ZAR",
            status: "CONFIRMED",
            confirmedById: actorUserId,
            confirmedAt: new Date(),
            proofUrl: c.proofUrl,
            metadata: { source: "opportunity", opportunityId: current.id, opportunityCommitmentId: c.id },
          },
        })
      }

      await tx.investmentOpportunity.update({ where: { id: current.id }, data: { projectId: project.id, status: "FUNDED", fundedAt: new Date() } })
      return { project, reusable: false }
    })
    await addProjectActivity(result.project.id, actorUserId, "opportunity_converted", `Converted from opportunity "${opp.title}"`)
    await createAuditLog({ userId: actorUserId, circleId, action: "OPPORTUNITY_CONVERTED", entityType: "InvestmentOpportunity", entityId: opportunityId, newValues: { projectId: result.project.id } })
    await notifyOpportunityMembers(circleId, opportunityId, "OPPORTUNITY_FUNDED", `${opp.title} is now a fundable project`, "You can track it under Projects.")
    return result
  } catch (e: any) {
    // Idempotent recovery: if a project with the same slug already exists (race), reuse it.
    const code = e?.code
    if (code === "P2002") {
      const existingProject = await prisma.project.findUnique({ where: { circleId_slug: { circleId, slug: slugify(opp.title) } } })
      if (existingProject) return { project: existingProject, reusable: true }
    }
    throw e
  }
}