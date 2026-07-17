import { prisma } from "@/lib/prisma"

export async function getOwnerWalletDashboard() {
  try {
  const [totalWallets, circleWallets, totalLedgerTxs, pendingApprovals, recentWalletTxs, circles, recentLedgerTxs] = await Promise.all([
    prisma.wallet.count(),
    prisma.wallet.count({ where: { type: "CIRCLE_WALLET" } }),
    prisma.ledgerTransaction.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.walletApprovalRequest.count({ where: { status: "PENDING" } }),
    prisma.walletTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { wallet: { select: { circle: { select: { name: true } } } }, initiatedBy: { select: { name: true, email: true } } } }),
    prisma.circle.findMany({ where: { wallets: { some: {} } }, select: { id: true, name: true, type: true } }),
    prisma.ledgerTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { entries: true } }),
  ])

  return {
    totalWallets,
    circleWallets,
    totalLedgerTransactions: totalLedgerTxs._count,
    totalLedgerVolume: Number(totalLedgerTxs._sum.amount ?? 0),
    pendingApprovals,
    recentWalletTransactions: recentWalletTxs.map((t) => ({
      id: t.id, amount: Number(t.amount), type: t.type, status: t.status, circle: t.wallet.circle?.name || "—",
      initiatedBy: t.initiatedBy.name || t.initiatedBy.email,
      createdAt: t.createdAt.toISOString(),
    })),
    circlesWithWallets: circles.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    recentLedgerTxs: recentLedgerTxs.map((t) => ({
      id: t.id, amount: Number(t.amount), type: t.type, status: t.status,
      entryCount: t.entries.length,
      entries: t.entries.map((e) => ({ type: e.type, amount: Number(e.amount), description: e.description })),
      createdAt: t.createdAt.toISOString(),
    })),
  }
  } catch (error) {
    console.error("OWNER PAGE ERROR", { page: "Wallets", error, stack: error instanceof Error ? error.stack : undefined })
    throw error
  }
}

export async function getWalletLedgerHealth() {
  try {
  const exceptions: { severity: string; message: string; entityType: string; entityId?: string }[] = []

  // Check unbalanced transactions
  const allTxs = await prisma.ledgerTransaction.findMany({ include: { entries: true } })
  for (const tx of allTxs) {
    if (tx.entries.length < 2) {
      exceptions.push({ severity: "WARNING", message: `Ledger tx ${tx.id} has only ${tx.entries.length} entries`, entityType: "LedgerTransaction", entityId: tx.id })
      continue
    }
    const credits = tx.entries.filter((e) => e.type === "CREDIT").reduce((s, e) => s + Number(e.amount), 0)
    const debits = tx.entries.filter((e) => e.type === "DEBIT").reduce((s, e) => s + Number(e.amount), 0)
    if (Math.abs(credits - debits) > 0.01) {
      exceptions.push({ severity: "CRITICAL", message: `Unbalanced tx ${tx.id}: credits=${credits}, debits=${debits}`, entityType: "LedgerTransaction", entityId: tx.id })
    }
  }

  // Check CONFIRMED wallet txs without ledger entries
  const confirmedWalletTxs = await prisma.walletTransaction.findMany({ where: { status: "CONFIRMED" }, include: { ledgerTx: { include: { entries: true } } } })
  for (const wtx of confirmedWalletTxs) {
    if (wtx.ledgerTx.entries.length === 0) {
      exceptions.push({ severity: "WARNING", message: `Wallet tx ${wtx.id} confirmed but has no ledger entries`, entityType: "WalletTransaction", entityId: wtx.id })
    }
  }

  // Check circles without wallets
  const circlesNoWallet = await prisma.circle.findMany({ where: { wallets: { none: {} }, isActive: true, deletedAt: null }, select: { id: true, name: true } })
  for (const c of circlesNoWallet) {
    exceptions.push({ severity: "INFO", message: `Circle "${c.name}" has no wallet`, entityType: "Circle", entityId: c.id })
  }

  // Check approved requests with unconfirmed wallet txs
  const approvedRequests = await prisma.walletApprovalRequest.findMany({ where: { status: "APPROVED" }, include: { walletTx: true } })
  for (const r of approvedRequests) {
    if (r.walletTx.status !== "CONFIRMED") {
      exceptions.push({ severity: "WARNING", message: `Approval ${r.id} approved but wallet tx not confirmed`, entityType: "WalletApprovalRequest", entityId: r.id })
    }
  }

  const critical = exceptions.filter((e) => e.severity === "CRITICAL").length
  const warnings = exceptions.filter((e) => e.severity === "WARNING").length

  return {
    healthy: critical === 0 && warnings === 0,
    status: critical > 0 ? "CRITICAL" : warnings > 0 ? "WARNING" : "HEALTHY",
    critical, warnings,
    exceptions: exceptions.slice(0, 50),
  }
  } catch (error) {
    console.error("OWNER PAGE ERROR", { page: "Wallet Ledger Health", error, stack: error instanceof Error ? error.stack : undefined })
    throw error
  }
}
