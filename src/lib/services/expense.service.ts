import { prisma } from "@/lib/prisma"
import type { SplitType } from "@/generated/prisma"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import { createAuditLog } from "@/lib/services/audit.service"
import { recordExpenseToLedger, reverseExpenseLedger } from "@/lib/services/wallet.service"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

// ─── Expense CRUD ─────────────────────────────────────────

export async function listExpenses(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_VIEW })

  const expenses = await prisma.expense.findMany({
    where: { circleId, deletedAt: null },
    include: {
      paidBy: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
    orderBy: { expenseDate: "desc" },
  })

  return expenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
    splits: e.splits.map((s) => ({
      ...s,
      amount: Number(s.amount),
      percentage: s.percentage ? Number(s.percentage) : null,
    })),
  }))
}

export async function getExpenseById(circleId: string, expenseId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_VIEW })

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      paidBy: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  })

  if (!expense || expense.circleId !== circleId) throw new Error("Expense not found")

  return {
    ...expense,
    amount: Number(expense.amount),
    splits: expense.splits.map((s) => ({
      ...s,
      amount: Number(s.amount),
      percentage: s.percentage ? Number(s.percentage) : null,
    })),
  }
}

export async function createExpense(
  circleId: string,
  userId: string,
  data: {
    title: string; notes?: string | null; amount: number; category: string
    splitType: string; expenseDate: string; receiptUrl?: string | null
    paidById: string; splits: { userId: string; amount?: number; percentage?: number }[]
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_CREATE })

  // Verify payer is a member
  const payer = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: data.paidById } },
  })
  if (!payer) throw new Error("Payer is not a member of this circle")

  const splitRecords = calculateSplits(
    data.amount,
    data.splitType,
    data.splits
  )

  const expense = await prisma.expense.create({
    data: {
      circleId,
      paidById: data.paidById,
      createdById: userId,
      title: data.title,
      notes: data.notes || null,
      amount: data.amount,
      category: data.category,
      splitType: data.splitType as SplitType,
      expenseDate: new Date(data.expenseDate),
      receiptUrl: data.receiptUrl || null,
      splits: {
        create: splitRecords.map((s) => ({
          userId: s.userId,
          amount: s.amount,
          percentage: s.percentage || null,
        })),
      },
    },
    include: {
      paidBy: { select: { id: true, name: true, email: true, image: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  })

  await recalculateCircleBalances(circleId)

  notifyCircleMembers(circleId, userId, {
    type: "EXPENSE_ADDED",
    title: `New expense: ${data.title}`,
    message: `${expense.paidBy?.name || "Someone"} paid ${data.amount} for "${data.title}"`,
    link: `/circles/${circleId}/expenses`,
  })

  // Record to wallet ledger (fire-and-forget)
  recordExpenseToLedger(circleId, expense.id, data.amount, userId).catch(console.error)

  return {
    ...expense,
    amount: Number(expense.amount),
    splits: expense.splits.map((s) => ({
      ...s,
      amount: Number(s.amount),
      percentage: s.percentage ? Number(s.percentage) : null,
    })),
  }
}

export async function deleteExpense(circleId: string, expenseId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_VIEW })

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { splits: true },
  })
  if (!expense || expense.circleId !== circleId) throw new Error("Expense not found")

  // Only OWNER/ADMIN or the creator can delete (if no splits settled)
  const hasDelete = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_DELETE })
  if (!hasDelete && expense.createdById !== userId) {
    throw new Error("Insufficient permissions")
  }
  const hasSettled = expense.splits.some((s) => s.settled)
  if (!hasDelete && hasSettled) {
    throw new Error("Cannot delete an expense with settled splits")
  }

  await prisma.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date() } })
  await createAuditLog({ userId, circleId, action: "SOFT_DELETE", entityType: "Expense", entityId: expenseId })
  await recalculateCircleBalances(circleId)

  // Reverse wallet ledger entry (fire-and-forget)
  reverseExpenseLedger(circleId, expenseId, Number(expense.amount), userId).catch(console.error)

  return { success: true }
}

// ─── Split Calculation ────────────────────────────────────

export function calculateSplits(
  totalAmount: number,
  splitType: string,
  members: { userId: string; amount?: number; percentage?: number }[]
): { userId: string; amount: number; percentage?: number }[] {
  if (members.length === 0) return []

  switch (splitType) {
    case "EQUAL": {
      const perPerson = totalAmount / members.length
      return members.map((m) => ({
        userId: m.userId,
        amount: Math.round(perPerson * 100) / 100,
      }))
    }
    case "EXACT": {
      return members.map((m) => ({
        userId: m.userId,
        amount: Number(m.amount) || 0,
      }))
    }
    case "PERCENTAGE": {
      return members.map((m) => ({
        userId: m.userId,
        amount: Math.round(totalAmount * ((Number(m.percentage) || 0) / 100) * 100) / 100,
        percentage: Number(m.percentage) || 0,
      }))
    }
    default:
      throw new Error(`Unknown split type: ${splitType}`)
  }
}

// ─── Balance Recalculation ────────────────────────────────

export async function recalculateCircleBalances(circleId: string) {
  // Get all unsettled expense splits for the circle
  const splits = await prisma.expenseSplit.findMany({
    where: {
      expense: { circleId, deletedAt: null },
      settled: false,
    },
    include: {
      expense: { select: { paidById: true } },
    },
  })

  // Clear existing balances
  await prisma.balance.deleteMany({ where: { circleId } })

  // Calculate net balances
  const balances = new Map<string, number>() // key: debtorId:creditorId

  for (const split of splits) {
    const paidById = split.expense.paidById
    const debtorId = split.userId

    if (debtorId === paidById) continue // No self-balance

    const key = `${debtorId}:${paidById}`
    const current = balances.get(key) || 0
    balances.set(key, current + Number(split.amount))

    // Also reduce opposite direction
    const reverseKey = `${paidById}:${debtorId}`
    const reverse = balances.get(reverseKey) || 0
    if (reverse > 0) {
      const toClear = Math.min(Number(split.amount), reverse)
      balances.set(reverseKey, reverse - toClear)
      if (toClear < Number(split.amount)) {
        balances.set(key, Number(split.amount) - toClear)
      } else {
        balances.delete(key)
      }
    }
  }

  // Subtract confirmed settlements from balances
  const confirmedSettlements = await prisma.settlement.findMany({
    where: { circleId, status: "CONFIRMED", deletedAt: null },
    select: { debtorId: true, creditorId: true, amount: true },
  })

  for (const s of confirmedSettlements) {
    const key = `${s.debtorId}:${s.creditorId}`
    const current = balances.get(key) || 0
    const newAmount = current - Number(s.amount)
    if (newAmount <= 0.01) {
      balances.delete(key)
    } else {
      balances.set(key, newAmount)
    }
  }

  // Upsert balance records
  for (const [key, amount] of balances) {
    if (amount <= 0.01) continue
    const [debtorId, creditorId] = key.split(":")
    await prisma.balance.upsert({
      where: {
        circleId_debtorId_creditorId: {
          circleId,
          debtorId,
          creditorId,
        },
      },
      create: { circleId, debtorId, creditorId, amount },
      update: { amount, updatedAt: new Date() },
    })
  }
}

// ─── Summary ──────────────────────────────────────────────

export async function getExpenseSummary(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_VIEW })

  const [totalExpenses, myPaid, myOwed] = await Promise.all([
    prisma.expense.aggregate({
      where: { circleId, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { circleId, paidById: userId, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.expenseSplit.aggregate({
      where: {
        expense: { circleId },
        userId,
        settled: false,
        NOT: { expense: { paidById: userId } },
      },
      _sum: { amount: true },
    }),
  ])

  const myOwedAmount = Number(myOwed._sum.amount ?? 0)
  const othersOweMe = await prisma.expenseSplit.aggregate({
    where: {
      expense: { circleId, paidById: userId },
      settled: false,
      NOT: { userId },
    },
    _sum: { amount: true },
  })

  return {
    totalExpenses: Number(totalExpenses._sum.amount ?? 0),
    amountIPaid: Number(myPaid._sum.amount ?? 0),
    amountIOwe: myOwedAmount,
    amountOwedToMe: Number(othersOweMe._sum.amount ?? 0),
    netBalance: Number(othersOweMe._sum.amount ?? 0) - myOwedAmount,
  }
}
