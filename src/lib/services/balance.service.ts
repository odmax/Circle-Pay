import { prisma } from "@/lib/prisma"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import { recordSettlementToLedger } from "@/lib/services/wallet.service"

async function getMemberRole(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
    select: { role: true },
  })
  return m?.role ?? null
}

async function requireMemberRole(circleId: string, userId: string, allowed: string[]) {
  const role = await getMemberRole(circleId, userId)
  if (!role) throw new Error("Not a member of this circle")
  if (!allowed.includes(role)) throw new Error("Insufficient permissions")
  return role
}

// ─── Balances ─────────────────────────────────────────────

export async function getCircleBalances(circleId: string, userId: string) {
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

  const [balances, myDebts, myCredits] = await Promise.all([
    prisma.balance.findMany({
      where: { circleId, amount: { gt: 0 } },
      include: {
        debtor: { select: { id: true, name: true, email: true, image: true } },
        creditor: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { amount: "desc" },
    }),
    prisma.balance.aggregate({
      where: { circleId, debtorId: userId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.balance.aggregate({
      where: { circleId, creditorId: userId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ])

  const all = balances.map((b) => ({
    ...b,
    amount: Number(b.amount),
  }))

  const my = all.filter((b) => b.debtorId === userId || b.creditorId === userId)
  const totalOwe = Number(myDebts._sum.amount ?? 0)
  const totalOwed = Number(myCredits._sum.amount ?? 0)

  return {
    allBalances: all,
    myBalances: my,
    totalIOwe: totalOwe,
    totalOwedToMe: totalOwed,
    netBalance: totalOwed - totalOwe,
  }
}

// ─── Settlements ──────────────────────────────────────────

export async function listSettlements(circleId: string, userId: string, status?: string) {
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

  const where: Record<string, unknown> = { circleId, deletedAt: null }
  if (status) where.status = status

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      debtor: { select: { id: true, name: true, email: true, image: true } },
      creditor: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return settlements.map((s) => ({ ...s, amount: Number(s.amount) }))
}

export async function createSettlement(
  circleId: string,
  userId: string,
  data: { debtorId: string; creditorId: string; amount: number; settlementDate: string; note?: string | null }
) {
  const role = await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

  // Members can only create settlements they are part of
  if (role === "MEMBER" && userId !== data.debtorId && userId !== data.creditorId) {
    throw new Error("You must be the debtor or creditor to create a settlement")
  }

  // Check outstanding balance
  const balance = await prisma.balance.findUnique({
    where: {
      circleId_debtorId_creditorId: {
        circleId,
        debtorId: data.debtorId,
        creditorId: data.creditorId,
      },
    },
  })

  const maxAmount = balance ? Number(balance.amount) : 0
  if (data.amount > maxAmount) {
    throw new Error(`Settlement amount cannot exceed outstanding balance of ${maxAmount}`)
  }

  const settlement = await prisma.settlement.create({
    data: {
      circleId,
      debtorId: data.debtorId,
      creditorId: data.creditorId,
      amount: data.amount,
      note: data.note || null,
      settlementDate: new Date(data.settlementDate),
      createdById: userId,
    },
    include: {
      debtor: { select: { id: true, name: true, email: true, image: true } },
      creditor: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const debtorName = settlement.debtor?.name || "Someone"
  const creditorName = settlement.creditor?.name || "Someone"
  notifyCircleMembers(circleId, userId, {
    type: "SETTLEMENT_REQUESTED",
    title: `Settlement: ${debtorName} → ${creditorName}`,
    message: `${debtorName} settled ${data.amount} with ${creditorName}`,
    link: `/circles/${circleId}/balances`,
  })

  return { ...settlement, amount: Number(settlement.amount) }
}

export async function confirmSettlement(circleId: string, settlementId: string, userId: string) {
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

  const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } })
  if (!settlement || settlement.circleId !== circleId) throw new Error("Settlement not found")
  if (settlement.status !== "PENDING") throw new Error("Settlement is not pending")

  const isCreator = settlement.createdById === userId
  const canConfirm = settlement.creditorId === userId || settlement.debtorId === userId || isCreator

  if (!canConfirm) throw new Error("You are not authorized to confirm this settlement")

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      status: "CONFIRMED",
      confirmedById: userId,
      confirmedAt: new Date(),
    },
  })

  // Reduce the balance
  const balance = await prisma.balance.findUnique({
    where: {
      circleId_debtorId_creditorId: {
        circleId,
        debtorId: settlement.debtorId,
        creditorId: settlement.creditorId,
      },
    },
  })

  if (balance) {
    const newAmount = Number(balance.amount) - Number(settlement.amount)
    if (newAmount <= 0.01) {
      await prisma.balance.delete({
        where: {
          circleId_debtorId_creditorId: {
            circleId,
            debtorId: settlement.debtorId,
            creditorId: settlement.creditorId,
          },
        },
      })
    } else {
      await prisma.balance.update({
        where: {
          circleId_debtorId_creditorId: {
            circleId,
            debtorId: settlement.debtorId,
            creditorId: settlement.creditorId,
          },
        },
        data: { amount: newAmount },
      })
    }
  }

  notifyCircleMembers(circleId, userId, {
    type: "SETTLEMENT_CONFIRMED",
    title: "Settlement confirmed",
    message: `Settlement of ${Number(settlement.amount)} has been confirmed`,
    link: `/circles/${circleId}/balances`,
  })

  recordSettlementToLedger(circleId, settlementId, Number(settlement.amount), userId).catch(console.error)

  return { ...updated, amount: Number(updated.amount) }
}

export async function rejectSettlement(circleId: string, settlementId: string, userId: string) {
  await requireMemberRole(circleId, userId, ["OWNER", "ADMIN", "MEMBER"])

  const settlement = await prisma.settlement.findUnique({ where: { id: settlementId, deletedAt: null } })
  if (!settlement || settlement.circleId !== circleId) throw new Error("Settlement not found")
  if (settlement.status !== "PENDING") throw new Error("Settlement is not pending")

  const canReject = settlement.creditorId === userId || settlement.debtorId === userId

  if (!canReject) throw new Error("You are not authorized to reject this settlement")

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: { status: "REJECTED" },
  })

  notifyCircleMembers(circleId, userId, {
    type: "SETTLEMENT_REJECTED",
    title: "Settlement rejected",
    message: `Settlement of ${Number(settlement.amount)} was rejected`,
    link: `/circles/${circleId}/balances`,
  })

  return { ...updated, amount: Number(updated.amount) }
}
