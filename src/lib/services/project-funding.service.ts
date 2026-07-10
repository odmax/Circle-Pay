import { prisma } from "@/lib/prisma"
import { recordContributionToLedger } from "@/lib/services/wallet.service"
import { addProjectActivity } from "@/lib/services/project.service"

export async function createFundingRound(projectId: string, userId: string, data: { name: string; description?: string; targetAmount: number }) {
  return prisma.projectFundingRound.create({
    data: { projectId, createdById: userId, name: data.name, description: data.description || null, targetAmount: data.targetAmount },
  })
}

export async function openFundingRound(roundId: string) {
  const round = await prisma.projectFundingRound.update({ where: { id: roundId }, data: { status: "OPEN", opensAt: new Date() }, include: { project: { select: { id: true, circleId: true } } } })
  await addProjectActivity(round.project.id, null, "funding_round_opened", `Funding round "${round.name}" opened`)
  return round
}

export async function closeFundingRound(roundId: string) {
  const round = await prisma.projectFundingRound.update({ where: { id: roundId }, data: { status: "CLOSED", closesAt: new Date() }, include: { project: { select: { id: true } } } })
  await addProjectActivity(round.project.id, null, "funding_round_closed", `Funding round "${round.name}" closed`)
  return round
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

  // Update project + funding round totals
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
