import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

export async function calculateProjectOwnership(projectId: string) {
  const contribs = await prisma.projectContribution.findMany({ where: { projectId, status: "CONFIRMED" }, include: { user: { select: { id: true, name: true, email: true } } } })
  const total = contribs.reduce((s, c) => s + Number(c.amount), 0)
  const byUser: Record<string, { user: any; amount: number }> = {}
  for (const c of contribs) { if (!byUser[c.userId]) byUser[c.userId] = { user: c.user, amount: 0 }; byUser[c.userId].amount += Number(c.amount) }
  const owners = Object.values(byUser).map((u) => ({ ...u.user, contribution: u.amount, ownership: total > 0 ? Math.round((u.amount / total) * 10000) / 100 : 0 }))
  return { total, owners }
}

export async function createProfitDistribution(projectId: string, circleId: string, userId: string, data: { name: string; method?: string }) {
  const ownership = await calculateProjectOwnership(projectId)
  if (ownership.total === 0) throw new Error("No confirmed contributions")
  const { getProjectROIDashboard } = await import("@/lib/services/project-roi.service")
  const roi = await getProjectROIDashboard(projectId)
  const profit = (roi.summary as any).netProfit || 0
  if (profit <= 0) throw new Error("No distributable profit")

  const dist = await prisma.projectDistribution.create({
    data: {
      projectId, circleId, createdById: userId, name: data.name, method: (data.method as any) || "BY_CONTRIBUTION_SHARE",
      totalProfit: profit,
      items: {
        create: ownership.owners.map((o) => ({
          projectId, userId: o.id, contributionAmount: o.contribution, ownershipPercentage: o.ownership, profitShare: Math.round(profit * (o.ownership / 100) * 100) / 100,
        })),
      },
    },
    include: { items: true },
  })
  await addProjectActivity(projectId, userId, "distribution_created", `Distribution "${data.name}" created — R${profit.toLocaleString()}`)
  return dist
}

export async function approveProfitDistribution(distributionId: string, adminId: string) {
  const d = await prisma.projectDistribution.findUnique({ where: { id: distributionId }, include: { project: { select: { id: true } } } })
  if (!d) throw new Error("Not found")
  if (d.status !== "DRAFT" && d.status !== "PENDING_APPROVAL") throw new Error("Invalid status")
  const updated = await prisma.projectDistribution.update({ where: { id: distributionId }, data: { status: "APPROVED", approvedById: adminId, approvedAt: new Date() }, include: { items: true } })
  await prisma.projectDistributionItem.updateMany({ where: { distributionId }, data: { status: "APPROVED" } })
  await addProjectActivity(d.project.id, adminId, "distribution_approved", `Distribution "${d.name}" approved`)
  return updated
}

export async function markDistributionPaid(distributionId: string, adminId: string) {
  const d = await prisma.projectDistribution.findUnique({ where: { id: distributionId }, include: { project: { select: { id: true, circleId: true } } } })
  if (!d) throw new Error("Not found")
  if (d.status !== "APPROVED") throw new Error("Must be approved first")
  const updated = await prisma.projectDistribution.update({ where: { id: distributionId }, data: { status: "PAID", paidAt: new Date() }, include: { items: true } })
  await prisma.projectDistributionItem.updateMany({ where: { distributionId }, data: { status: "PAID", paidAt: new Date() } })
  // Ledger entry
  try {
    const wallet = await prisma.wallet.findFirst({ where: { circleId: d.project.circleId, type: "CIRCLE_WALLET" } })
    if (wallet) {
      const payoutAcc = await prisma.ledgerAccount.findFirst({ where: { walletId: wallet.id, type: "PAYOUTS" as any } })
      const adjAcc = await prisma.ledgerAccount.findFirst({ where: { walletId: wallet.id, type: "ADJUSTMENTS" as any } })
      if (payoutAcc && adjAcc) {
        const key = `project-distribution:${distributionId}`
        const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
        if (!existing) {
          await prisma.ledgerTransaction.create({
            data: {
              circleId: d.project.circleId, amount: Number(d.totalProfit), type: "PAYOUT", status: "CONFIRMED", idempotencyKey: key,
              entries: { create: [{ accountId: payoutAcc.id, type: "DEBIT", amount: Number(d.totalProfit), description: `Distribution: ${d.name}` }, { accountId: adjAcc.id, type: "CREDIT", amount: Number(d.totalProfit), description: `Distribution: ${d.name}` }] },
            },
          })
        }
      }
    }
  } catch {}
  await addProjectActivity(d.project.id, adminId, "distribution_paid", `Distribution "${d.name}" paid`)
  return updated
}

export async function cancelDistribution(distributionId: string, adminId: string) {
  const d = await prisma.projectDistribution.findUnique({ where: { id: distributionId }, include: { project: { select: { id: true } } } })
  if (!d) throw new Error("Not found")
  if (d.status === "PAID") throw new Error("Cannot cancel paid distribution")
  const updated = await prisma.projectDistribution.update({ where: { id: distributionId }, data: { status: "CANCELLED" } })
  await prisma.projectDistributionItem.updateMany({ where: { distributionId }, data: { status: "CANCELLED" } })
  await addProjectActivity(d.project.id, adminId, "distribution_cancelled", `Distribution "${d.name}" cancelled`)
  return updated
}

export async function getProjectDistributionDashboard(projectId: string) {
  const [distributions, ownership] = await Promise.all([
    prisma.projectDistribution.findMany({ where: { projectId }, include: { items: { include: { user: { select: { name: true, email: true } } } }, createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    calculateProjectOwnership(projectId),
  ])
  return { distributions, ownership }
}

export async function getMemberProjectPortfolio(userId: string) {
  const contribs = await prisma.projectContribution.findMany({ where: { userId, status: "CONFIRMED" }, include: { project: { select: { id: true, name: true, circleId: true } } } })
  const items = await prisma.projectDistributionItem.findMany({ where: { userId, status: { not: "CANCELLED" } }, include: { distribution: { select: { projectId: true, name: true } } } })
  const totalInvested = contribs.reduce((s, c) => s + Number(c.amount), 0)
  return { totalInvested, contributions: contribs, distributionItems: items }
}
