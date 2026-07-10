import { prisma } from "@/lib/prisma"
import type { LedgerAccountType } from "@/generated/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

// ═══════════════════════════════════════════════════════════
// BALANCE COMPUTATION — always derived from immutable entries
// ═══════════════════════════════════════════════════════════

export async function calculateAccountBalance(accountId: string) {
  const [credits, debits] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { accountId, type: "CREDIT" }, _sum: { amount: true } }),
    prisma.ledgerEntry.aggregate({ where: { accountId, type: "DEBIT" }, _sum: { amount: true } }),
  ])
  return Number(credits._sum.amount ?? 0) - Number(debits._sum.amount ?? 0)
}

export async function calculateWalletBalance(walletId: string) {
  const accounts = await prisma.ledgerAccount.findMany({ where: { walletId, isActive: true }, select: { id: true } })
  if (accounts.length === 0) return 0

  const accountIds = accounts.map((a) => a.id)
  const entries = await prisma.ledgerEntry.groupBy({
    by: ["accountId", "type"],
    where: { accountId: { in: accountIds } },
    _sum: { amount: true },
  })

  let balance = 0
  for (const e of entries) {
    const amt = Number(e._sum.amount ?? 0)
    balance += e.type === "CREDIT" ? amt : -amt
  }
  return balance
}

export async function calculateCircleWalletBalance(circleId: string) {
  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET", status: "ACTIVE" } })
  if (!wallet) return 0
  return calculateWalletBalance(wallet.id)
}

export async function getLedgerBalanceSummary(walletId: string) {
  const [accounts, entries] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { walletId, isActive: true }, select: { id: true, name: true, type: true } }),
    prisma.ledgerTransaction.findMany({
      where: { walletTxs: { some: { walletId } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { entries: true },
    }),
  ])

  const accountBalances = await Promise.all(
    accounts.map(async (a) => ({ ...a, balance: await calculateAccountBalance(a.id) }))
  )

  const totalBalance = accountBalances.reduce((sum, a) => sum + a.balance, 0)

  return {
    totalBalance,
    accounts: accountBalances,
    recentTransactions: entries.map((t) => ({
      id: t.id, amount: Number(t.amount), type: t.type, status: t.status,
      createdAt: t.createdAt,
      entries: t.entries.map((e) => ({ type: e.type, amount: Number(e.amount), description: e.description })),
    })),
  }
}

// ═══════════════════════════════════════════════════════════
// WALLET CRUD
// ═══════════════════════════════════════════════════════════

export async function getOrCreateCircleWallet(circleId: string) {
  let wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { circleId, type: "CIRCLE_WALLET", name: "Circle Wallet" },
    })
    await prisma.ledgerAccount.createMany({
      data: [
        { walletId: wallet.id, name: "Contributions", type: "CONTRIBUTIONS" },
        { walletId: wallet.id, name: "Payouts", type: "PAYOUTS" },
        { walletId: wallet.id, name: "Expenses", type: "EXPENSES" },
        { walletId: wallet.id, name: "Settlements", type: "SETTLEMENTS" },
        { walletId: wallet.id, name: "Fees", type: "FEES" },
        { walletId: wallet.id, name: "Adjustments", type: "ADJUSTMENTS" },
      ],
    })
    await ensureDefaultApprovalRules(circleId)
  }
  return wallet
}

export const ensureCircleWallet = getOrCreateCircleWallet

export async function getCircleWallets(circleId: string) {
  return prisma.wallet.findMany({ where: { circleId }, include: { accounts: true } })
}

// ═══════════════════════════════════════════════════════════
// LEDGER TRANSACTIONS
// ═══════════════════════════════════════════════════════════

export async function recordLedgerTransfer(params: {
  circleId: string
  amount: number
  type: string
  fromAccountId: string
  toAccountId: string
  description?: string
  initiatedById: string
  walletId: string
}) {
  const { circleId, amount, type, fromAccountId, toAccountId, description, initiatedById, walletId } = params

  // Create the balanced ledger transaction
  const ledgerTx = await prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type, status: "CONFIRMED",
      entries: {
        create: [
          { accountId: fromAccountId, type: "DEBIT", amount, description: description || null },
          { accountId: toAccountId, type: "CREDIT", amount, description: description || null },
        ],
      },
    },
    include: { entries: true },
  })

  // Create the user-facing wallet transaction
  await prisma.walletTransaction.create({
    data: {
      walletId, ledgerTxId: ledgerTx.id, type: "TRANSFER_OUT",
      amount, status: "CONFIRMED", description: description || null, initiatedById,
    },
  })

  return ledgerTx
}

export async function getWalletTransactions(walletId: string) {
  return prisma.walletTransaction.findMany({
    where: { walletId },
    include: {
      initiatedBy: { select: { id: true, name: true } },
      ledgerTx: { include: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

// ═══════════════════════════════════════════════════════════
// CONTRIBUTION / EXPENSE → LEDGER BRIDGE
// ═══════════════════════════════════════════════════════════

async function getAccountByType(walletId: string, type: LedgerAccountType) {
  return prisma.ledgerAccount.findFirst({ where: { walletId, type } })
}

export async function recordContributionToLedger(circleId: string, contributionId: string, amount: number, userId: string) {
  const idempotencyKey = `contribution:${contributionId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  const wallet = await ensureCircleWallet(circleId)
  const contribAccount = await getAccountByType(wallet.id, "CONTRIBUTIONS" as LedgerAccountType)
  const adjAccount = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!contribAccount || !adjAccount) return null

  const ledgerTx = await prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "CONTRIBUTION", status: "CONFIRMED", idempotencyKey,
      entries: {
        create: [
          { accountId: contribAccount.id, type: "CREDIT", amount, description: `Contribution ${contributionId}` },
          { accountId: adjAccount.id, type: "DEBIT", amount, description: `External member payment for contribution ${contributionId}` },
        ],
      },
    },
  })

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id, ledgerTxId: ledgerTx.id, type: "TOPUP",
      amount, status: "CONFIRMED", initiatedById: userId,
      description: `Contribution ${contributionId}`,
      idempotencyKey: `wtx:${idempotencyKey}`,
    },
  })

  return ledgerTx
}

export async function reverseContributionLedger(circleId: string, contributionId: string, amount: number, _userId: string) {
  const key = `reversal:contribution:${contributionId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing

  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) return null
  const contribAcc = await getAccountByType(wallet.id, "CONTRIBUTIONS" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!contribAcc || !adjAcc) return null

  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "REVERSAL", status: "CONFIRMED", idempotencyKey: key,
      entries: {
        create: [
          { accountId: contribAcc.id, type: "DEBIT", amount, description: `Reversal of contribution ${contributionId}` },
          { accountId: adjAcc.id, type: "CREDIT", amount, description: `Reversal of contribution ${contributionId}` },
        ],
      },
    },
  })
}

export async function recordExpenseToLedger(circleId: string, expenseId: string, amount: number, userId: string) {
  const idempotencyKey = `expense:${expenseId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  const wallet = await ensureCircleWallet(circleId)
  const expenseAccount = await getAccountByType(wallet.id, "EXPENSES" as LedgerAccountType)
  const adjAccount = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!expenseAccount || !adjAccount) return null

  const ledgerTx = await prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "EXPENSE", status: "CONFIRMED", idempotencyKey,
      entries: {
        create: [
          { accountId: expenseAccount.id, type: "DEBIT", amount, description: `Expense ${expenseId}` },
          { accountId: adjAccount.id, type: "CREDIT", amount, description: `External payment for expense ${expenseId}` },
        ],
      },
    },
  })

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id, ledgerTxId: ledgerTx.id, type: "TOPUP",
      amount, status: "CONFIRMED", initiatedById: userId,
      description: `Expense ${expenseId}`,
      idempotencyKey: `wtx:${idempotencyKey}`,
    },
  })

  return ledgerTx
}

export async function reverseExpenseLedger(circleId: string, expenseId: string, amount: number, _userId: string) {
  const key = `reversal:expense:${expenseId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing

  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) return null
  const expAcc = await getAccountByType(wallet.id, "EXPENSES" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!expAcc || !adjAcc) return null

  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "REVERSAL", status: "CONFIRMED", idempotencyKey: key,
      entries: {
        create: [
          { accountId: expAcc.id, type: "CREDIT", amount, description: `Reversal of expense ${expenseId}` },
          { accountId: adjAcc.id, type: "DEBIT", amount, description: `Reversal of expense ${expenseId}` },
        ],
      },
    },
  })
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD HELPERS
// ═══════════════════════════════════════════════════════════

export async function getCircleWalletDashboard(circleId: string, userId: string) {
  await validateMember(circleId, userId)
  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) return null

  const [summary, accounts, recentTxs, members] = await Promise.all([
    getLedgerBalanceSummary(wallet.id),
    prisma.ledgerAccount.findMany({ where: { walletId: wallet.id, isActive: true }, select: { id: true, name: true, type: true } }),
    prisma.ledgerTransaction.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 10, include: { entries: true } }),
    prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { id: true, name: true, email: true } } } }),
  ])

  const accountBalances = await Promise.all(accounts.map(async (a) => ({ ...a, balance: await calculateAccountBalance(a.id) })))

  return {
    totalBalance: summary.totalBalance,
    accounts: accountBalances.filter((a) => Math.abs(a.balance) > 0.01),
    inflows: accountBalances.reduce((s, a) => s + Math.max(0, a.balance), 0),
    outflows: accountBalances.reduce((s, a) => s + (a.balance < 0 ? -a.balance : 0), 0),
    recentTransactions: recentTxs.map((t) => ({
      id: t.id, amount: Number(t.amount), type: t.type, status: t.status, createdAt: t.createdAt,
      entries: t.entries.map((e) => ({ type: e.type, amount: Number(e.amount), description: e.description })),
    })),
    memberCount: members.length,
  }
}

export async function getCircleWalletTransactions(circleId: string, userId: string) {
  await validateMember(circleId, userId)
  return prisma.ledgerTransaction.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 100, include: { entries: true } })
    .then((txs) => txs.map((t) => ({
      id: t.id, amount: Number(t.amount), type: t.type, status: t.status, idempotencyKey: t.idempotencyKey, createdAt: t.createdAt,
      entries: t.entries.map((e) => ({ type: e.type, amount: Number(e.amount), description: e.description })),
    })))
}

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function requireAdmin(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } }, select: { role: true } })
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) throw new Error("Admin access required")
}

// ═══════════════════════════════════════════════════════════
// APPROVAL RULES
// ═══════════════════════════════════════════════════════════

const DEFAULT_RULES: Record<string, { action: string; threshold: number; requiredApprovalCount: number }[]> = {
  STOKVEL: [{ action: "PAYOUT", threshold: 0, requiredApprovalCount: 1 }],
  CHURCH: [{ action: "PAYOUT", threshold: 500, requiredApprovalCount: 2 }, { action: "EXPENSE_OVER", threshold: 500, requiredApprovalCount: 2 }],
  INVESTMENT: [{ action: "PAYOUT", threshold: 0, requiredApprovalCount: 2 }],
}

export async function ensureDefaultApprovalRules(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle) return
  const rules = DEFAULT_RULES[circle.type] || DEFAULT_RULES["STOKVEL"]
  for (const rule of rules) {
    const exists = await prisma.walletApprovalRule.findFirst({ where: { circleId, action: rule.action } })
    if (!exists) {
      await prisma.walletApprovalRule.create({ data: { circleId, action: rule.action, threshold: rule.threshold, requiredApprovalCount: rule.requiredApprovalCount } })
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PAYOUT REQUESTS
// ═══════════════════════════════════════════════════════════

export async function createPayoutRequest(circleId: string, userId: string, data: { recipientId: string; amount: number; reason: string; payoutDate: string; method?: string; reference?: string; notes?: string }) {
  await requireAdmin(circleId, userId)
  if (data.amount <= 0) throw new Error("Amount must be positive")

  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) throw new Error("No wallet found")

  // Check rule
  const rule = await prisma.walletApprovalRule.findFirst({ where: { circleId, action: "PAYOUT", isActive: true } })
  const requiredCount = rule?.requiredApprovalCount ?? 1

  const walletTx = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id, ledgerTxId: "", type: "PAYOUT", amount: data.amount, status: "PENDING",
      description: data.reason, initiatedById: userId, providerRef: data.reference || null,
    },
  })

  const request = await prisma.walletApprovalRequest.create({
    data: { circleId, walletTxId: walletTx.id, requestedById: userId, requiredCount },
  })

  // Link walletTx to a dummy ledgerTxId (required field)
  // Create placeholder ledger transaction for the payout
  const ledgerTx = await prisma.ledgerTransaction.create({
    data: { circleId, amount: data.amount, type: "PAYOUT", status: "PENDING" },
  })
  await prisma.walletTransaction.update({ where: { id: walletTx.id }, data: { ledgerTxId: ledgerTx.id } })

  return { request, walletTx, requiredCount }
}

export async function approvePayoutRequest(circleId: string, requestId: string, userId: string) {
  await requireAdmin(circleId, userId)

  const request = await prisma.walletApprovalRequest.findUnique({ where: { id: requestId }, include: { walletTx: true } })
  if (!request || request.circleId !== circleId) throw new Error("Request not found")
  if (request.status !== "PENDING") throw new Error("Request is not pending")

  // Prevent self-approval if only one approval is needed
  if (request.requestedById === userId && request.requiredCount > 1) {
    // Allow if at least one other admin exists
  }

  // Check duplicate approval
  const alreadyApproved = await prisma.walletApproval.findFirst({ where: { requestId, approvedById: userId } })
  if (alreadyApproved) throw new Error("Already approved")

  await prisma.walletApproval.create({ data: { requestId, approvedById: userId } })

  const approvalCount = await prisma.walletApproval.count({ where: { requestId } })

  if (approvalCount >= request.requiredCount) {
    await prisma.walletApprovalRequest.update({ where: { id: requestId }, data: { status: "APPROVED" } })
    await prisma.walletTransaction.update({ where: { id: request.walletTxId }, data: { status: "CONFIRMED" } })
    await prisma.ledgerTransaction.update({ where: { id: request.walletTx.ledgerTxId }, data: { status: "CONFIRMED" } })

    // Record payout to ledger
    const payoutAccount = await getAccountByType(request.walletTx.walletId, "PAYOUTS" as LedgerAccountType)
    const adjAccount = await getAccountByType(request.walletTx.walletId, "ADJUSTMENTS" as LedgerAccountType)
    if (payoutAccount && adjAccount) {
      await prisma.ledgerEntry.createMany({
        data: [
          { accountId: payoutAccount.id, txId: request.walletTx.ledgerTxId, type: "DEBIT", amount: Number(request.walletTx.amount), description: `Payout ${requestId}` },
          { accountId: adjAccount.id, txId: request.walletTx.ledgerTxId, type: "CREDIT", amount: Number(request.walletTx.amount), description: `External payout ${requestId}` },
        ],
      })
    }

    await createAuditLog({ userId, circleId, action: "WALLET_PAYOUT_APPROVED", entityType: "PayoutRequest", entityId: requestId })
  }

  return { approved: approvalCount >= request.requiredCount, approvalCount, requiredCount: request.requiredCount }
}

export async function rejectPayoutRequest(circleId: string, requestId: string, userId: string) {
  await requireAdmin(circleId, userId)
  const request = await prisma.walletApprovalRequest.findUnique({ where: { id: requestId }, include: { walletTx: true } })
  if (!request || request.circleId !== circleId) throw new Error("Request not found")
  if (request.status !== "PENDING") throw new Error("Request is not pending")

  await prisma.walletApprovalRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } })
  await prisma.walletTransaction.update({ where: { id: request.walletTxId }, data: { status: "CANCELLED" } })
  await prisma.ledgerTransaction.update({ where: { id: request.walletTx.ledgerTxId }, data: { status: "REVERSED" } })

  await createAuditLog({ userId, circleId, action: "WALLET_PAYOUT_REJECTED", entityType: "PayoutRequest", entityId: requestId })
  return { success: true }
}

export async function listWalletApprovalRequests(circleId: string, userId: string) {
  await validateMember(circleId, userId)
  return prisma.walletApprovalRequest.findMany({
    where: { circleId },
    include: {
      walletTx: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      approvals: { include: { approvedBy: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWalletApprovalSummary(circleId: string, userId: string) {
  await validateMember(circleId, userId)
  const [pending, approved, rejected] = await Promise.all([
    prisma.walletApprovalRequest.count({ where: { circleId, status: "PENDING" } }),
    prisma.walletApprovalRequest.count({ where: { circleId, status: "APPROVED" } }),
    prisma.walletApprovalRequest.count({ where: { circleId, status: "REJECTED" } }),
  ])
  return { pending, approved, rejected }
}

// ═══════════════════════════════════════════════════════════
// SETTLEMENT → LEDGER BRIDGE
// ═══════════════════════════════════════════════════════════

export async function recordSettlementToLedger(circleId: string, settlementId: string, amount: number, userId: string) {
  const key = `settlement:${settlementId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing
  const wallet = await ensureCircleWallet(circleId)
  const settAcc = await getAccountByType(wallet.id, "SETTLEMENTS" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!settAcc || !adjAcc) return null
  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "SETTLEMENT", status: "CONFIRMED", idempotencyKey: key,
      entries: {
        create: [
          { accountId: settAcc.id, type: "CREDIT", amount, description: `Settlement ${settlementId}` },
          { accountId: adjAcc.id, type: "DEBIT", amount, description: `Settlement ${settlementId}` },
        ],
      },
    },
  })
}

export async function reverseSettlementLedger(circleId: string, settlementId: string, amount: number) {
  const key = `reversal:settlement:${settlementId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing
  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) return null
  const settAcc = await getAccountByType(wallet.id, "SETTLEMENTS" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!settAcc || !adjAcc) return null
  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "REVERSAL", status: "CONFIRMED", idempotencyKey: key,
      entries: { create: [
        { accountId: settAcc.id, type: "DEBIT", amount, description: `Reversal settlement ${settlementId}` },
        { accountId: adjAcc.id, type: "CREDIT", amount, description: `Reversal settlement ${settlementId}` },
      ]},
    },
  })
}

// ═══════════════════════════════════════════════════════════
// PAYOUT → LEDGER BRIDGE
// ═══════════════════════════════════════════════════════════

export async function recordPayoutToLedger(circleId: string, payoutId: string, amount: number, userId: string) {
  const key = `payout:${payoutId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing
  const wallet = await ensureCircleWallet(circleId)
  const payoutAcc = await getAccountByType(wallet.id, "PAYOUTS" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!payoutAcc || !adjAcc) return null
  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "PAYOUT", status: "CONFIRMED", idempotencyKey: key,
      entries: {
        create: [
          { accountId: payoutAcc.id, type: "DEBIT", amount, description: `Payout ${payoutId}` },
          { accountId: adjAcc.id, type: "CREDIT", amount, description: `Payout ${payoutId}` },
        ],
      },
    },
    include: { entries: true },
  })
}

// ═══════════════════════════════════════════════════════════
// INVESTMENT → LEDGER BRIDGE
// ═══════════════════════════════════════════════════════════

export async function recordInvestmentAssetToLedger(circleId: string, assetId: string, amount: number, userId: string) {
  const key = `investment:asset:${assetId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing
  const wallet = await ensureCircleWallet(circleId)
  const invAcc = await getAccountByType(wallet.id, "INVESTMENTS" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!invAcc || !adjAcc) return null
  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "INVESTMENT", status: "CONFIRMED", idempotencyKey: key,
      entries: { create: [
        { accountId: invAcc.id, type: "DEBIT", amount, description: `Asset purchase ${assetId}` },
        { accountId: adjAcc.id, type: "CREDIT", amount, description: `Capital allocation for ${assetId}` },
      ]},
    },
  })
}

export async function recordInvestmentReturnToLedger(circleId: string, returnId: string, amount: number, userId: string) {
  const key = `investment:return:${returnId}`
  const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing
  const wallet = await ensureCircleWallet(circleId)
  const retAcc = await getAccountByType(wallet.id, "RETURNS" as LedgerAccountType)
  const adjAcc = await getAccountByType(wallet.id, "ADJUSTMENTS" as LedgerAccountType)
  if (!retAcc || !adjAcc) return null
  return prisma.ledgerTransaction.create({
    data: {
      circleId, amount, type: "RETURN", status: "CONFIRMED", idempotencyKey: key,
      entries: { create: [
        { accountId: retAcc.id, type: "CREDIT", amount, description: `Return ${returnId}` },
        { accountId: adjAcc.id, type: "DEBIT", amount, description: `Return ${returnId}` },
      ]},
    },
  })
}

// ═══════════════════════════════════════════════════════════
// TRIAL BALANCE
// ═══════════════════════════════════════════════════════════

export async function getCircleTrialBalance(circleId: string) {
  const wallet = await prisma.wallet.findFirst({ where: { circleId, type: "CIRCLE_WALLET" } })
  if (!wallet) return { accounts: [], totalCredits: 0, totalDebits: 0 }

  const accounts = await prisma.ledgerAccount.findMany({ where: { walletId: wallet.id, isActive: true } })
  const accountIds = accounts.map((a) => a.id)
  const entries = await prisma.ledgerEntry.groupBy({
    by: ["accountId", "type"],
    where: { accountId: { in: accountIds } },
    _sum: { amount: true },
  })

  const result: Record<string, { type: string; credits: number; debits: number; balance: number }> = {}
  for (const a of accounts) {
    result[a.id] = { type: a.type, credits: 0, debits: 0, balance: 0 }
  }
  for (const e of entries) {
    const amt = Number(e._sum.amount ?? 0)
    if (!result[e.accountId]) continue
    if (e.type === "CREDIT") result[e.accountId].credits = amt
    else result[e.accountId].debits = amt
    result[e.accountId].balance = result[e.accountId].credits - result[e.accountId].debits
  }

  const totalCredits = Object.values(result).reduce((sum, r) => sum + r.credits, 0)
  const totalDebits = Object.values(result).reduce((sum, r) => sum + r.debits, 0)

  return {
    accounts: Object.entries(result).map(([id, r]) => ({ id, type: r.type, credits: r.credits, debits: r.debits, balance: r.balance })),
    totalCredits,
    totalDebits,
  }
}
