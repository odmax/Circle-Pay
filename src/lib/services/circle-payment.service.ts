import { prisma } from "@/lib/prisma"
import { recordContributionToLedger } from "@/lib/services/wallet.service"

export async function getUserPaymentIntents(userId: string, circleId: string) {
  return prisma.circlePaymentIntent.findMany({
    where: { userId, circleId },
    orderBy: { createdAt: "desc" },
    include: { confirmedBy: { select: { name: true } } },
  })
}

export async function getCirclePaymentIntents(circleId: string) {
  return prisma.circlePaymentIntent.findMany({
    where: { circleId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true } }, confirmedBy: { select: { name: true } } },
  })
}

export async function generateMonthlyPaymentIntents(circleId: string, userId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, include: { members: { include: { user: true } }, contributionPlans: { where: { isActive: true }, take: 1 } } })
  if (!circle) throw new Error("Circle not found")
  const plan = circle.contributionPlans[0]
  const amount = plan ? Number(plan.amount) : 0
  const type = circle.type === "STOKVEL" ? "CONTRIBUTION" : circle.type === "INVESTMENT" ? "INVESTMENT_DUE" : circle.type === "SAVINGS" ? "SAVINGS_DUE" : "CONTRIBUTION"
  const count = { generated: 0 }
  for (const member of circle.members) {
    await prisma.circlePaymentIntent.create({
      data: {
        circleId, userId: member.userId,
        type: type as any, amount, currency: circle.currency,
        dueDate: new Date(Date.now() + 7 * 86400000),
      },
    })
    count.generated++
  }
  return count
}

export async function submitProofOfPayment(paymentIntentId: string, userId: string, proofReference: string, proofUrl?: string) {
  const intent = await prisma.circlePaymentIntent.findUnique({ where: { id: paymentIntentId } })
  if (!intent || intent.userId !== userId) throw new Error("Not found")
  if (intent.status !== "PENDING" && intent.status !== "OVERDUE") throw new Error("Invalid status")
  return prisma.circlePaymentIntent.update({ where: { id: paymentIntentId }, data: { status: "PROOF_SUBMITTED", proofReference, proofUrl: proofUrl || null } })
}

export async function confirmPaymentIntent(paymentIntentId: string, confirmedById: string) {
  const intent = await prisma.circlePaymentIntent.findUnique({ where: { id: paymentIntentId } })
  if (!intent) throw new Error("Not found")
  if (intent.status !== "PROOF_SUBMITTED") throw new Error("No proof submitted")
  const updated = await prisma.circlePaymentIntent.update({
    where: { id: paymentIntentId },
    data: { status: "CONFIRMED", confirmedById, confirmedAt: new Date() },
  })
  // If contribution type, create contribution record + ledger
  if (intent.relatedContributionId) {
    await prisma.contribution.update({ where: { id: intent.relatedContributionId }, data: { status: "PAID" } }).catch(() => {})
  }
  recordContributionToLedger(intent.circleId, `intent:${intent.id}`, Number(intent.amount), intent.userId).catch(() => {})
  return updated
}

export async function rejectPaymentIntent(paymentIntentId: string, rejectedById: string) {
  const intent = await prisma.circlePaymentIntent.findUnique({ where: { id: paymentIntentId } })
  if (!intent) throw new Error("Not found")
  if (intent.status !== "PROOF_SUBMITTED") throw new Error("No proof submitted")
  return prisma.circlePaymentIntent.update({ where: { id: paymentIntentId }, data: { status: "REJECTED", rejectedById, rejectedAt: new Date() } })
}

export async function markOverduePaymentIntents() {
  const overdue = await prisma.circlePaymentIntent.findMany({ where: { status: "PENDING", dueDate: { lt: new Date() } } })
  for (const p of overdue) {
    await prisma.circlePaymentIntent.update({ where: { id: p.id }, data: { status: "OVERDUE" } }).catch(() => {})
  }
  return { marked: overdue.length }
}
