import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

// ─── Investor Agreement Lifecycle ───────────────────────────

const VALID_AGREEMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["EXPIRED", "TERMINATED"],
  EXPIRED: [],
  TERMINATED: [],
  CANCELLED: [],
}

function validateAgreementTransition(current: string, next: string) {
  if (!VALID_AGREEMENT_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`Cannot transition agreement from ${current} to ${next}`)
  }
}

export async function createInvestorAgreement(projectId: string, participantId: string, data: {
  agreementType: "EQUITY" | "PROFIT_SHARE" | "REVENUE_SHARE" | "FIXED_RETURN" | "LOAN" | "CAPPED_RETURN" | "DONATION"
  principal: number
  ownershipPercentage?: number
  profitPercentage?: number
  revenuePercentage?: number
  interestRate?: number
  repaymentPriority?: number
  returnCap?: number
  effectiveDate?: Date
  expiryDate?: Date
  votingRights?: boolean
  agreementDocumentUrl?: string
  terms?: string
}) {
  if (data.principal <= 0) throw new Error("Principal must be greater than zero")
  if (data.ownershipPercentage !== undefined && (data.ownershipPercentage < 0 || data.ownershipPercentage > 100)) {
    throw new Error("Ownership percentage must be between 0 and 100")
  }
  if (data.profitPercentage !== undefined && (data.profitPercentage < 0 || data.profitPercentage > 100)) {
    throw new Error("Profit percentage must be between 0 and 100")
  }
  if (data.revenuePercentage !== undefined && (data.revenuePercentage < 0 || data.revenuePercentage > 100)) {
    throw new Error("Revenue percentage must be between 0 and 100")
  }
  if (data.interestRate !== undefined && (data.interestRate < 0 || data.interestRate > 1)) {
    throw new Error("Interest rate must be between 0 and 1 (e.g. 0.05 = 5%)")
  }

  const participant = await prisma.projectParticipant.findUnique({ where: { id: participantId } })
  if (!participant) throw new Error("Participant not found")

  // Get next version number
  const existingAgreements = await prisma.projectInvestorAgreement.count({
    where: { projectId, participantId },
  })

  const agreement = await prisma.projectInvestorAgreement.create({
    data: {
      projectId,
      participantId,
      agreementType: data.agreementType,
      principal: data.principal,
      ownershipPercentage: data.ownershipPercentage ?? null,
      profitPercentage: data.profitPercentage ?? null,
      revenuePercentage: data.revenuePercentage ?? null,
      interestRate: data.interestRate ?? null,
      repaymentPriority: data.repaymentPriority ?? 0,
      returnCap: data.returnCap ?? null,
      effectiveDate: data.effectiveDate || null,
      expiryDate: data.expiryDate || null,
      votingRights: data.votingRights ?? false,
      agreementDocumentUrl: data.agreementDocumentUrl || null,
      terms: data.terms || null,
      status: "DRAFT",
      version: existingAgreements + 1,
    },
  })

  await addProjectActivity(projectId, null, "agreement_created", `Investor agreement created (${data.agreementType})`, `Principal: R${data.principal.toLocaleString()}`)
  return agreement
}

export async function transitionAgreement(agreementId: string, nextStatus: string, userId: string) {
  const agreement = await prisma.projectInvestorAgreement.findUnique({ where: { id: agreementId } })
  if (!agreement) throw new Error("Agreement not found")
  validateAgreementTransition(agreement.status, nextStatus)

  const updateData: Record<string, unknown> = { status: nextStatus }
  if (nextStatus === "ACTIVE") updateData.effectiveDate = new Date()
  if (nextStatus === "EXPIRED" || nextStatus === "TERMINATED") updateData.expiryDate = new Date()
  if (nextStatus === "APPROVED") { updateData.approvedById = userId; updateData.approvedAt = new Date() }

  const updated = await prisma.projectInvestorAgreement.update({
    where: { id: agreementId },
    data: updateData as any,
  })

  await addProjectActivity(agreement.projectId, userId, `agreement_${nextStatus.toLowerCase()}`, `Agreement ${nextStatus.toLowerCase()}`, `${agreement.agreementType} — R${Number(agreement.principal).toLocaleString()}`)
  return updated
}

export async function getProjectAgreements(projectId: string) {
  const agreements = await prisma.projectInvestorAgreement.findMany({
    where: { projectId },
    include: {
      participant: { include: { user: { select: { id: true, name: true, email: true } } } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const summary = {
    totalAgreements: agreements.length,
    activeAgreements: agreements.filter((a) => a.status === "ACTIVE").length,
    totalPrincipal: agreements.filter((a) => a.status === "ACTIVE" || a.status === "APPROVED").reduce((s, a) => s + Number(a.principal), 0),
    totalOwnership: agreements.filter((a) => a.ownershipPercentage).reduce((s, a) => s + Number(a.ownershipPercentage), 0),
    totalProfitShare: agreements.filter((a) => a.profitPercentage).reduce((s, a) => s + Number(a.profitPercentage), 0),
    totalRevenueShare: agreements.filter((a) => a.revenuePercentage).reduce((s, a) => s + Number(a.revenuePercentage), 0),
    byType: agreements.reduce((acc, a) => {
      acc[a.agreementType] = (acc[a.agreementType] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  return { agreements, summary }
}

export async function updateAgreementTerms(agreementId: string, userId: string, data: {
  principal?: number
  ownershipPercentage?: number
  profitPercentage?: number
  revenuePercentage?: number
  interestRate?: number
  repaymentPriority?: number
  returnCap?: number
  terms?: string
  votingRights?: boolean
}) {
  const agreement = await prisma.projectInvestorAgreement.findUnique({ where: { id: agreementId } })
  if (!agreement) throw new Error("Agreement not found")
  if (agreement.status === "ACTIVE" || agreement.status === "EXPIRED" || agreement.status === "TERMINATED") {
    throw new Error("Cannot modify a finalized agreement")
  }

  const safe: Record<string, unknown> = {}
  if (data.principal !== undefined) safe.principal = data.principal
  if (data.ownershipPercentage !== undefined) safe.ownershipPercentage = data.ownershipPercentage
  if (data.profitPercentage !== undefined) safe.profitPercentage = data.profitPercentage
  if (data.revenuePercentage !== undefined) safe.revenuePercentage = data.revenuePercentage
  if (data.interestRate !== undefined) safe.interestRate = data.interestRate
  if (data.repaymentPriority !== undefined) safe.repaymentPriority = data.repaymentPriority
  if (data.returnCap !== undefined) safe.returnCap = data.returnCap
  if (data.terms !== undefined) safe.terms = data.terms
  if (data.votingRights !== undefined) safe.votingRights = data.votingRights

  // Create new version
  const updated = await prisma.projectInvestorAgreement.update({
    where: { id: agreementId },
    data: { ...safe, version: agreement.version + 1 } as any,
  })

  await addProjectActivity(agreement.projectId, userId, "agreement_updated", `Agreement terms updated`, `Version ${updated.version}`)
  return updated
}
