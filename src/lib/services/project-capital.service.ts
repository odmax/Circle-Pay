import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"
import { recordContributionToLedger } from "@/lib/services/wallet.service"

// ─── Capital Transaction Engine ─────────────────────────────

export async function recordCapitalTransaction(projectId: string, participantId: string, data: {
  amount: number
  fundingRoundId?: string
  allocationId?: string
  commitmentId?: string
  classification?: "REQUIRED_EQUITY" | "EXTRA_EQUITY" | "SHORTFALL_COVER_EQUITY" | "MEMBER_ADVANCE" | "EXTERNAL_INVESTMENT" | "LOAN" | "DONATION" | "SPONSORSHIP"
  reference?: string
  proofUrl?: string
  ownershipEligibleAmount?: number
  repaymentEligibleAmount?: number
  profitEligibleAmount?: number
  transactionDate?: Date
}) {
  if (data.amount <= 0) throw new Error("Amount must be greater than zero")

  const participant = await prisma.projectParticipant.findUnique({ where: { id: participantId } })
  if (!participant) throw new Error("Participant not found")

  const classification = data.classification || "REQUIRED_EQUITY"

  const ownershipEligible = data.ownershipEligibleAmount ?? (
    ["REQUIRED_EQUITY", "EXTRA_EQUITY", "SHORTFALL_COVER_EQUITY", "EXTERNAL_INVESTMENT"].includes(classification) ? data.amount : 0
  )
  const repaymentEligible = data.repaymentEligibleAmount ?? (
    ["MEMBER_ADVANCE", "LOAN"].includes(classification) ? data.amount : 0
  )
  const profitEligible = data.profitEligibleAmount ?? (
    ["REQUIRED_EQUITY", "EXTRA_EQUITY", "SHORTFALL_COVER_EQUITY", "EXTERNAL_INVESTMENT"].includes(classification) ? data.amount : 0
  )

  const tx = await prisma.projectCapitalTransaction.create({
    data: {
      projectId, participantId, fundingRoundId: data.fundingRoundId || null,
      allocationId: data.allocationId || null, commitmentId: data.commitmentId || null,
      amount: data.amount, classification, ownershipEligibleAmount: ownershipEligible,
      repaymentEligibleAmount: repaymentEligible, profitEligibleAmount: profitEligible,
      reference: data.reference || null, proofUrl: data.proofUrl || null,
      transactionDate: data.transactionDate || new Date(), status: "PENDING",
    },
  })

  await addProjectActivity(projectId, participant.userId, "capital_tx_recorded", `Capital transaction of R${data.amount.toLocaleString()} recorded`, `Classification: ${classification}`)
  return tx
}

export async function submitCapitalTransaction(txId: string, userId: string, proofUrl?: string) {
  const tx = await prisma.projectCapitalTransaction.findUnique({ where: { id: txId } })
  if (!tx) throw new Error("Transaction not found")
  if (tx.status !== "PENDING") throw new Error("Transaction is not pending")

  return prisma.projectCapitalTransaction.update({
    where: { id: txId },
    data: { status: "SUBMITTED", proofUrl: proofUrl || tx.proofUrl },
  })
}

export async function confirmCapitalTransaction(txId: string, adminId: string) {
  const tx = await prisma.projectCapitalTransaction.findUnique({
    where: { id: txId },
    include: { project: { select: { id: true, circleId: true } }, participant: { select: { userId: true } } },
  })
  if (!tx) throw new Error("Transaction not found")
  if (tx.status !== "SUBMITTED") throw new Error("Transaction must be submitted")

  const updated = await prisma.projectCapitalTransaction.update({
    where: { id: txId },
    data: { status: "CONFIRMED", confirmedById: adminId, confirmedAt: new Date() },
  })

  if (tx.allocationId) {
    const allocation = await prisma.projectFundingAllocation.findUnique({ where: { id: tx.allocationId } })
    if (allocation) {
      const newPaid = Number(allocation.paidAmount) + Number(tx.amount)
      const allocated = Number(allocation.allocatedAmount)
      const newShortfall = Math.max(allocated - newPaid, 0)
      const newExcess = Math.max(newPaid - allocated, 0)

      await prisma.projectFundingAllocation.update({
        where: { id: tx.allocationId },
        data: {
          paidAmount: newPaid, shortfallAmount: newShortfall, excessAmount: newExcess,
          status: newShortfall > 0 ? "SHORTFALL" : newExcess > 0 ? "PARTIALLY_PAID" : "PAID",
        },
      })
    }
  }

  await prisma.project.update({ where: { id: tx.projectId }, data: { currentAmount: { increment: Number(tx.amount) } } })
  if (tx.fundingRoundId) {
    await prisma.projectFundingRound.update({ where: { id: tx.fundingRoundId }, data: { currentAmount: { increment: Number(tx.amount) } } })
  }

  await addProjectActivity(tx.projectId, adminId, "capital_tx_confirmed", `Capital transaction of R${Number(tx.amount).toLocaleString()} confirmed`, `Classification: ${tx.classification}`)
  recordContributionToLedger(tx.project.circleId, `project-capital:${tx.id}`, Number(tx.amount), tx.participant.userId || "").catch(() => {})

  const project = await prisma.project.findUnique({ where: { id: tx.projectId }, select: { currentAmount: true, targetAmount: true } })
  if (project?.targetAmount && Number(project.currentAmount) >= Number(project.targetAmount)) {
    await prisma.project.update({ where: { id: tx.projectId }, data: { status: "FULLY_FUNDED" } })
  }

  return updated
}

export async function rejectCapitalTransaction(txId: string, adminId: string, reason?: string) {
  const tx = await prisma.projectCapitalTransaction.findUnique({ where: { id: txId } })
  if (!tx) throw new Error("Transaction not found")
  if (tx.status !== "SUBMITTED") throw new Error("Transaction must be submitted")
  return prisma.projectCapitalTransaction.update({
    where: { id: txId },
    data: { status: "REJECTED", rejectedById: adminId, rejectedAt: new Date(), rejectionReason: reason || null },
  })
}

export async function cancelCapitalTransaction(txId: string, userId: string) {
  const tx = await prisma.projectCapitalTransaction.findUnique({ where: { id: txId } })
  if (!tx) throw new Error("Transaction not found")
  if (tx.status !== "PENDING") throw new Error("Can only cancel pending transactions")
  return prisma.projectCapitalTransaction.update({ where: { id: txId }, data: { status: "CANCELLED" } })
}

export async function getProjectCapitalTransactions(projectId: string, filters?: { classification?: string; status?: string }) {
  const where: Record<string, unknown> = { projectId }
  if (filters?.classification) where.classification = filters.classification
  if (filters?.status) where.status = filters.status

  const [transactions, summary] = await Promise.all([
    prisma.projectCapitalTransaction.findMany({
      where,
      include: {
        participant: { include: { user: { select: { id: true, name: true } } } },
        confirmedBy: { select: { name: true } },
        rejectedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectCapitalTransaction.aggregate({
      where: { projectId, status: "CONFIRMED" },
      _sum: { amount: true, ownershipEligibleAmount: true, repaymentEligibleAmount: true, profitEligibleAmount: true },
      _count: true,
    }),
  ])

  const byClassification = await prisma.projectCapitalTransaction.groupBy({
    by: ["classification"],
    where: { projectId, status: "CONFIRMED" },
    _sum: { amount: true },
    _count: true,
  })

  return {
    transactions,
    summary: {
      totalConfirmed: Number(summary._sum.amount || 0),
      totalOwnershipEligible: Number(summary._sum.ownershipEligibleAmount || 0),
      totalRepaymentEligible: Number(summary._sum.repaymentEligibleAmount || 0),
      totalProfitEligible: Number(summary._sum.profitEligibleAmount || 0),
      transactionCount: summary._count,
      byClassification,
    },
  }
}
