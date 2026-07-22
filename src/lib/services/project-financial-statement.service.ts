import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

// ─── Distribution Period Management ──────────────────────────

export async function createDistributionPeriod(projectId: string, circleId: string, userId: string, data: {
  name: string
  periodStart: Date
  periodEnd: Date
}) {
  if (data.periodEnd <= data.periodStart) throw new Error("Period end must be after start")

  // Check no overlapping open periods
  const overlap = await prisma.projectDistributionPeriod.findFirst({
    where: {
      projectId,
      status: { notIn: ["DISTRIBUTED"] },
      periodStart: { lte: data.periodEnd },
      periodEnd: { gte: data.periodStart },
    },
  })
  if (overlap) throw new Error(`Overlaps with existing period "${overlap.name}"`)

  return prisma.projectDistributionPeriod.create({
    data: {
      projectId, circleId, createdById: userId,
      name: data.name,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    },
  })
}

export async function closeDistributionPeriod(periodId: string, userId: string) {
  const period = await prisma.projectDistributionPeriod.findUnique({ where: { id: periodId } })
  if (!period) throw new Error("Period not found")
  if (period.status !== "OPEN") throw new Error("Period is not open")

  // Calculate totals from revenue and expenses in this period
  const [revenues, expenses] = await Promise.all([
    prisma.projectRevenue.findMany({
      where: {
        projectId: period.projectId,
        status: "CONFIRMED",
        revenueDate: { gte: period.periodStart, lte: period.periodEnd },
      },
    }),
    prisma.projectExpense.findMany({
      where: {
        projectId: period.projectId,
        status: "PAID",
        expenseDate: { gte: period.periodStart, lte: period.periodEnd },
      },
    }),
  ])

  const totalRevenue = revenues.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const distributableProfit = Math.max(0, totalRevenue - totalExpenses)

  return prisma.projectDistributionPeriod.update({
    where: { id: periodId },
    data: {
      status: "CLOSED",
      totalRevenue,
      totalExpenses,
      distributableProfit,
      closedById: userId,
      closedAt: new Date(),
    },
  })
}

export async function getProjectDistributionPeriods(projectId: string) {
  const periods = await prisma.projectDistributionPeriod.findMany({
    where: { projectId },
    include: {
      createdBy: { select: { name: true } },
      distribution: { select: { id: true, name: true, status: true, totalProfit: true } },
    },
    orderBy: { periodStart: "desc" },
  })

  const summary = {
    totalPeriods: periods.length,
    openPeriods: periods.filter((p) => p.status === "OPEN").length,
    closedPeriods: periods.filter((p) => p.status === "CLOSED").length,
    distributedPeriods: periods.filter((p) => p.status === "DISTRIBUTED").length,
    totalRevenue: periods.reduce((s, p) => s + Number(p.totalRevenue), 0),
    totalExpenses: periods.reduce((s, p) => s + Number(p.totalExpenses), 0),
    totalDistributed: periods.reduce((s, p) => s + Number(p.distributedAmount), 0),
  }

  return { periods, summary }
}

// ─── Financial Statements ───────────────────────────────────

export async function generateFinancialStatement(
  projectId: string,
  circleId: string,
  userId: string,
  data: {
    statementType: "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW" | "PROFIT_LOSS" | "OWNERSHIP_SUMMARY"
    periodStart?: Date
    periodEnd?: Date
    notes?: string
  }
) {
  const now = new Date()
  const periodStart = data.periodStart || new Date(now.getFullYear(), 0, 1) // default: start of year
  const periodEnd = data.periodEnd || now

  // Fetch all relevant data
  const [project, revenues, expenses, assets, distributions] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { currentAmount: true, targetAmount: true } }),
    prisma.projectRevenue.findMany({
      where: {
        projectId, status: "CONFIRMED",
        revenueDate: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.projectExpense.findMany({
      where: {
        projectId,
        status: { in: ["APPROVED", "PAID"] },
      },
    }),
    prisma.projectAsset.findMany({ where: { projectId } }),
    prisma.projectDistribution.findMany({
      where: {
        projectId,
        status: { in: ["APPROVED", "PAID"] },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),
  ])

  const raised = Number(project?.currentAmount || 0)
  const target = Number(project?.targetAmount || 0)
  const totalRevenueGross = revenues.reduce((s, r) => s + Number(r.grossAmount || r.amount), 0)
  const totalDirectCosts = revenues.reduce((s, r) => s + Number(r.directCosts || 0), 0)
  const totalRevenueNet = revenues.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpensesPaid = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + Number(e.amount), 0)
  const totalExpensesApproved = expenses.filter((e) => e.status === "APPROVED").reduce((s, e) => s + Number(e.amount), 0)
  const totalAssetValue = assets.filter((a) => a.currentValue).reduce((s, a) => s + Number(a.currentValue || 0), 0)
  const totalAssetPurchase = assets.filter((a) => a.purchaseAmount).reduce((s, a) => s + Number(a.purchaseAmount || 0), 0)
  const totalDepreciation = assets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0)
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.totalProfit), 0)

  const breakdown: Record<string, any> = {}
  let statement: Record<string, any> = {}

  switch (data.statementType) {
    case "INCOME_STATEMENT":
    case "PROFIT_LOSS": {
      const netIncome = totalRevenueNet - totalExpensesPaid
      statement = {
        periodStart, periodEnd,
        revenue: {
          grossRevenue: totalRevenueGross,
          directCosts: totalDirectCosts,
          netRevenue: totalRevenueNet,
          byType: groupByType(revenues.map((r) => ({ type: r.type, amount: Number(r.amount) }))),
        },
        expenses: {
          totalPaid: totalExpensesPaid,
          totalApproved: totalExpensesApproved,
          byCategory: groupByCategory(expenses),
          variance: target > 0 ? { budget: target, actual: totalExpensesPaid, variance: target - totalExpensesPaid } : null,
        },
        netIncome,
        margin: totalRevenueNet > 0 ? Math.round((netIncome / totalRevenueNet) * 100) : 0,
        depreciation: totalDepreciation,
      }
      breakdown.revenue = statement.revenue
      breakdown.expenses = statement.expenses
      break
    }

    case "BALANCE_SHEET": {
      statement = {
        periodEnd,
        assets: {
          total: totalAssetValue,
          currentAssets: raised - totalExpensesPaid + totalRevenueNet,
          fixedAssets: totalAssetValue,
          totalAssetPurchase,
          totalDepreciation,
          byType: groupByType(assets.map((a) => ({ type: a.type, amount: Number(a.currentValue || 0) }))),
        },
        equity: {
          totalCapital: raised,
          retainedEarnings: totalRevenueNet - totalExpensesPaid - totalDistributed,
          totalDistributed,
          totalEquity: raised + (totalRevenueNet - totalExpensesPaid - totalDistributed),
        },
        fundingTarget: target,
        fundingProgress: target > 0 ? Math.round((raised / target) * 100) : 0,
      }
      break
    }

    case "CASH_FLOW": {
      const capitalInflows = raised
      const operatingInflows = totalRevenueNet
      const operatingOutflows = totalExpensesPaid
      const investingOutflows = totalAssetPurchase
      const financingOutflows = totalDistributed

      statement = {
        periodStart, periodEnd,
        operating: { inflows: operatingInflows, outflows: operatingOutflows, net: operatingInflows - operatingOutflows },
        investing: { inflows: 0, outflows: investingOutflows, net: -investingOutflows },
        financing: { inflows: capitalInflows, outflows: financingOutflows, net: capitalInflows - financingOutflows },
        netCashFlow: (operatingInflows - operatingOutflows) - investingOutflows + (capitalInflows - financingOutflows),
        cashBalance: raised + totalRevenueNet - totalExpensesPaid - totalAssetPurchase - totalDistributed,
      }
      break
    }

    case "OWNERSHIP_SUMMARY": {
      const snapshot = await prisma.projectOwnershipSnapshot.findFirst({
        where: { projectId, status: "EFFECTIVE" },
        include: {
          entries: {
            include: { participant: { include: { user: { select: { name: true } } } } },
            orderBy: { ownershipPercentage: "desc" },
          },
        },
      })
      statement = {
        effectiveOwnership: snapshot ? {
          version: snapshot.version,
          effectiveDate: snapshot.effectiveDate,
          totalCapital: Number(snapshot.totalCapital),
          participants: snapshot.entries.map((e) => ({
            name: e.participant.user?.name || e.participant.externalName || "Unknown",
            ownership: Number(e.ownershipPercentage),
            profitShare: Number(e.profitSharePercentage),
            voting: Number(e.votingPercentage),
            capital: Number(e.capitalContributed),
          })),
        } : null,
        distributionHistory: {
          totalDistributed,
          distributions: distributions.map((d) => ({ name: d.name, amount: Number(d.totalProfit), date: d.createdAt })),
        },
      }
      break
    }
  }

  const netIncome = totalRevenueNet - totalExpensesPaid

  const stmt = await prisma.projectFinancialStatement.create({
    data: {
      projectId, circleId, createdById: userId,
      statementType: data.statementType,
      periodStart, periodEnd,
      totalRevenue: totalRevenueNet,
      totalExpenses: totalExpensesPaid,
      netIncome,
      totalAssets: totalAssetValue,
      totalLiabilities: 0, // TODO: track liabilities
      totalEquity: raised + netIncome - totalDistributed,
      cashInflows: raised + totalRevenueNet,
      cashOutflows: totalExpensesPaid + totalAssetPurchase + totalDistributed,
      netCashFlow: raised + totalRevenueNet - totalExpensesPaid - totalAssetPurchase - totalDistributed,
      breakdown: breakdown as any,
      notes: data.notes || null,
    },
  })

  await addProjectActivity(projectId, userId, "financial_statement_generated",
    `${data.statementType.replace(/_/g, " ").toLowerCase()} generated`,
    `Period: ${periodStart.toLocaleDateString()} — ${periodEnd.toLocaleDateString()}`
  )

  return { statement: stmt, data: statement }
}

function groupByType(items: { type: string; amount: number }[]) {
  const result: Record<string, number> = {}
  for (const item of items) {
    result[item.type] = (result[item.type] || 0) + item.amount
  }
  return result
}

function groupByCategory(expenses: { category: string; amount: any; status: string }[]) {
  const result: Record<string, number> = {}
  for (const e of expenses) {
    if (e.status === "PAID" || e.status === "APPROVED") {
      result[e.category] = (result[e.category] || 0) + Number(e.amount)
    }
  }
  return result
}

export async function getProjectFinancialStatements(projectId: string) {
  return prisma.projectFinancialStatement.findMany({
    where: { projectId },
    include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function approveFinancialStatement(statementId: string, userId: string) {
  const stmt = await prisma.projectFinancialStatement.findUnique({ where: { id: statementId } })
  if (!stmt) throw new Error("Statement not found")
  if (stmt.status !== "DRAFT") throw new Error("Statement is not a draft")

  return prisma.projectFinancialStatement.update({
    where: { id: statementId },
    data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
  })
}
