import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectWaterfallConfig: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    projectDistribution: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    projectDistributionItem: { createMany: vi.fn() },
    projectDistributionPeriod: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    projectFinancialStatement: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    projectOwnershipSnapshot: { findFirst: vi.fn() },
    projectOwnershipEntry: { findMany: vi.fn() },
    projectRevenue: { findMany: vi.fn() },
    projectExpense: { findMany: vi.fn() },
    projectAsset: { findMany: vi.fn() },
    project: { findUnique: vi.fn() },
    projectContribution: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/services/project.service", () => ({
  addProjectActivity: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/services/project-roi.service", () => ({
  getProjectROIDashboard: vi.fn().mockResolvedValue({
    summary: { netProfit: 500000, raised: 5000000, totalRevenueNet: 1200000, totalExpensesPaid: 700000 },
  }),
}))

vi.mock("@/lib/services/project-distribution.service", () => ({
  calculateProjectOwnership: vi.fn().mockResolvedValue({
    total: 5000000,
    owners: [
      { id: "user1", name: "Alice", contribution: 2500000, ownership: 50 },
      { id: "user2", name: "Bob", contribution: 2500000, ownership: 50 },
    ],
  }),
}))

import { prisma } from "@/lib/prisma"
import {
  getWaterfallConfig, upsertWaterfallConfig, calculateWaterfallDistribution,
} from "@/lib/services/project-waterfall.service"
import {
  createDistributionPeriod, closeDistributionPeriod, getProjectDistributionPeriods,
  generateFinancialStatement,
} from "@/lib/services/project-financial-statement.service"

const mockPrisma = vi.mocked(prisma)

beforeEach(() => { vi.clearAllMocks() })

// ─── Test 1: Waterfall config with valid tiers ────
describe("Phase D: Waterfall Config", () => {
  it("Test 1: creates waterfall config with valid tier structure", async () => {
    ;(mockPrisma.projectWaterfallConfig.upsert as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "wf1", projectId: "proj1", ...args.create })
    )

    const result = await upsertWaterfallConfig("proj1", "user1", {
      enabled: true,
      tiers: [
        { name: "Preferred Return", type: "PREFERRED_RETURN", rate: 0.08, priority: 1 },
        { name: "Capital Return", type: "CAPITAL_RETURN", priority: 2 },
        { name: "80/20 Split", type: "PROFIT_SPLIT", lpPercent: 0.80, gpPercent: 0.20, priority: 3 },
      ],
    })

    expect(result.enabled).toBe(true)
  })

  it("Test 2: rejects waterfall with out-of-order priorities", async () => {
    await expect(
      upsertWaterfallConfig("proj1", "user1", {
        enabled: true,
        tiers: [
          { name: "Split", type: "PROFIT_SPLIT", lpPercent: 0.8, gpPercent: 0.2, priority: 1 },
          { name: "Preferred", type: "PREFERRED_RETURN", rate: 0.08, priority: 3 },
        ],
      })
    ).rejects.toThrow("sequential priority")
  })

  it("Test 3: rejects profit split where LP+GP != 100%", async () => {
    await expect(
      upsertWaterfallConfig("proj1", "user1", {
        enabled: true,
        tiers: [
          { name: "Bad Split", type: "PROFIT_SPLIT", lpPercent: 0.6, gpPercent: 0.2, priority: 1 },
        ],
      })
    ).rejects.toThrow("LP + GP = 100%")
  })
})

// ─── Test 4: Waterfall calculation ────
describe("Phase D: Waterfall Calculation", () => {
  it("Test 4: applies tiered waterfall distribution correctly", async () => {
    ;(mockPrisma.projectWaterfallConfig.findUnique as any).mockResolvedValue({
      id: "wf1", projectId: "proj1", enabled: true,
      preferredReturnAccrued: 0, capitalReturned: 0,
      tiers: [
        { name: "Preferred Return", type: "PREFERRED_RETURN", rate: 0.08, priority: 1 },
        { name: "Capital Return", type: "CAPITAL_RETURN", priority: 2 },
        { name: "80/20 Split", type: "PROFIT_SPLIT", lpPercent: 0.80, gpPercent: 0.20, priority: 3 },
      ],
    })

    const result = await calculateWaterfallDistribution("proj1", 500000, 5000000)

    // Preferred return: 5000000 * 0.08 = 400000 owed, paying min(500000, 400000) = 400000
    expect(result.tierResults.length).toBe(2) // preferred + profit split (capital fully returned already)
    expect(result.tierResults[0].type).toBe("PREFERRED_RETURN")
    expect(result.tierResults[0].amount).toBe(400000)
    expect(result.totalDistributed).toBeGreaterThan(0)
  })

  it("Test 5: returns zero when waterfall is disabled", async () => {
    ;(mockPrisma.projectWaterfallConfig.findUnique as any).mockResolvedValue({
      enabled: false, tiers: [],
    })

    const result = await calculateWaterfallDistribution("proj1", 500000, 5000000)
    expect(result.totalDistributed).toBe(0)
    expect(result.remainingProfit).toBe(500000)
  })
})

// ─── Test 6: Distribution periods ────
describe("Phase D: Distribution Periods", () => {
  it("Test 6: creates a distribution period with valid dates", async () => {
    ;(mockPrisma.projectDistributionPeriod.findFirst as any).mockResolvedValue(null)
    ;(mockPrisma.projectDistributionPeriod.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "dp1", ...args.data })
    )

    const result = await createDistributionPeriod("proj1", "circle1", "user1", {
      name: "Q1 2026",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-03-31"),
    })

    expect(result.name).toBe("Q1 2026")
  })

  it("Test 7: rejects overlapping distribution period", async () => {
    ;(mockPrisma.projectDistributionPeriod.findFirst as any).mockResolvedValue({
      id: "existing", name: "Q1 2026",
    })

    await expect(
      createDistributionPeriod("proj1", "circle1", "user1", {
        name: "Feb 2026",
        periodStart: new Date("2026-02-01"),
        periodEnd: new Date("2026-02-28"),
      })
    ).rejects.toThrow("Overlaps")
  })

  it("Test 8: closes period and calculates revenue/expenses", async () => {
    ;(mockPrisma.projectDistributionPeriod.findUnique as any).mockResolvedValue({
      id: "dp1", projectId: "proj1", status: "OPEN",
      periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-03-31"),
    })
    ;(mockPrisma.projectRevenue.findMany as any).mockResolvedValue([
      { amount: 800000 }, { amount: 400000 },
    ])
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([
      { amount: 300000 }, { amount: 200000 },
    ])
    ;(mockPrisma.projectDistributionPeriod.update as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "dp1", ...args.data })
    )

    const result = await closeDistributionPeriod("dp1", "user1")
    expect(result.status).toBe("CLOSED")
    expect(result.totalRevenue).toBe(1200000)
    expect(result.totalExpenses).toBe(500000)
    expect(result.distributableProfit).toBe(700000)
  })
})

// ─── Test 9: Financial statements ────
describe("Phase D: Financial Statements", () => {
  it("Test 9: generates income statement with correct structure", async () => {
    ;(mockPrisma.project.findUnique as any).mockResolvedValue({ currentAmount: 5000000, targetAmount: 5000000 })
    ;(mockPrisma.projectRevenue.findMany as any).mockResolvedValue([
      { id: "r1", amount: 800000, grossAmount: 1000000, directCosts: 200000, type: "SALE", status: "CONFIRMED", revenueDate: new Date() },
    ])
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([
      { id: "e1", amount: 300000, category: "LEGAL", status: "PAID" },
    ])
    ;(mockPrisma.projectAsset.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectDistribution.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectFinancialStatement.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "fs1", ...args.data })
    )

    const { statement, data } = await generateFinancialStatement("proj1", "circle1", "user1", {
      statementType: "INCOME_STATEMENT",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-03-31"),
    })

    expect(data.netIncome).toBe(500000) // 800k - 300k
    expect(data.revenue.netRevenue).toBe(800000)
    expect(data.revenue.directCosts).toBe(200000)
    expect(data.revenue.grossRevenue).toBe(1000000)
  })

  it("Test 10: generates balance sheet with asset values", async () => {
    ;(mockPrisma.project.findUnique as any).mockResolvedValue({ currentAmount: 5000000, targetAmount: 5000000 })
    ;(mockPrisma.projectRevenue.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectAsset.findMany as any).mockResolvedValue([
      { type: "EQUIPMENT", purchaseAmount: 500000, currentValue: 350000, accumulatedDepreciation: 150000 },
      { type: "VEHICLE", purchaseAmount: 1000000, currentValue: 800000, accumulatedDepreciation: 200000 },
    ])
    ;(mockPrisma.projectDistribution.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectFinancialStatement.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "fs2", ...args.data })
    )

    const { data } = await generateFinancialStatement("proj1", "circle1", "user1", {
      statementType: "BALANCE_SHEET",
    })

    expect(data.assets.total).toBe(1150000) // 350k + 800k
    expect(data.assets.totalDepreciation).toBe(350000) // 150k + 200k
    expect(data.equity.totalCapital).toBe(5000000)
  })

  it("Test 11: generates cash flow statement", async () => {
    ;(mockPrisma.project.findUnique as any).mockResolvedValue({ currentAmount: 5000000, targetAmount: 5000000 })
    ;(mockPrisma.projectRevenue.findMany as any).mockResolvedValue([
      { amount: 800000, grossAmount: 1000000, directCosts: 200000, type: "SALE", status: "CONFIRMED", revenueDate: new Date() },
    ])
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([
      { amount: 300000, category: "LEGAL", status: "PAID" },
    ])
    ;(mockPrisma.projectAsset.findMany as any).mockResolvedValue([
      { type: "EQUIPMENT", purchaseAmount: 500000, currentValue: 350000, accumulatedDepreciation: 150000 },
    ])
    ;(mockPrisma.projectDistribution.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectFinancialStatement.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "fs3", ...args.data })
    )

    const { data } = await generateFinancialStatement("proj1", "circle1", "user1", {
      statementType: "CASH_FLOW",
    })

    expect(data.operating.net).toBe(500000) // 800k - 300k
    expect(data.financing.inflows).toBe(5000000) // capital raised
    expect(data.cashBalance).toBeGreaterThan(0)
  })

  it("Test 12: profit != revenue (costs reduce profit)", async () => {
    ;(mockPrisma.project.findUnique as any).mockResolvedValue({ currentAmount: 1000000, targetAmount: 1000000 })
    ;(mockPrisma.projectRevenue.findMany as any).mockResolvedValue([
      { amount: 1000000, grossAmount: 1000000, directCosts: 0, type: "SALE", status: "CONFIRMED", revenueDate: new Date() },
    ])
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([
      { amount: 400000, category: "OPERATIONS", status: "PAID" },
    ])
    ;(mockPrisma.projectAsset.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectDistribution.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectFinancialStatement.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "fs4", ...args.data })
    )

    const { data } = await generateFinancialStatement("proj1", "circle1", "user1", {
      statementType: "PROFIT_LOSS",
    })

    expect(data.revenue.netRevenue).toBe(1000000)
    expect(data.netIncome).toBe(600000) // 1M - 400k
    expect(data.netIncome).not.toBe(data.revenue.netRevenue) // profit != revenue
  })
})

// ─── Test 13: Waterfall distribution with ownership ────
describe("Phase D: Waterfall Distribution", () => {
  it("Test 13: waterfall respects preferred return before profit split", async () => {
    ;(mockPrisma.projectWaterfallConfig.findUnique as any).mockResolvedValue({
      id: "wf1", projectId: "proj1", enabled: true,
      preferredReturnAccrued: 0, capitalReturned: 0,
      tiers: [
        { name: "Preferred Return", type: "PREFERRED_RETURN", rate: 0.10, priority: 1 },
        { name: "50/50 Split", type: "PROFIT_SPLIT", lpPercent: 0.5, gpPercent: 0.5, priority: 2 },
      ],
    })

    // Profit of 600k, capital of 2M
    const result = await calculateWaterfallDistribution("proj1", 600000, 2000000)

    // Preferred return: 2M * 0.10 = 200k, pays 200k
    expect(result.tierResults[0].type).toBe("PREFERRED_RETURN")
    expect(result.tierResults[0].amount).toBe(200000)

    // Remaining 400k goes to split
    expect(result.tierResults[1].type).toBe("PROFIT_SPLIT")
    expect(result.tierResults[1].amount).toBe(200000) // 50% of 400k

    expect(result.totalDistributed).toBe(400000) // 200k preferred + 200k split
    expect(result.remainingProfit).toBe(200000) // reserved/GP portion
  })

  it("Test 14: distribution cannot exceed available profit", async () => {
    ;(mockPrisma.projectWaterfallConfig.findUnique as any).mockResolvedValue({
      id: "wf1", projectId: "proj1", enabled: true,
      preferredReturnAccrued: 0, capitalReturned: 0,
      tiers: [
        { name: "Preferred Return", type: "PREFERRED_RETURN", rate: 0.20, priority: 1 },
      ],
    })

    // Profit of 100k, capital of 5M — preferred return would be 1M but only 100k available
    const result = await calculateWaterfallDistribution("proj1", 100000, 5000000)

    expect(result.tierResults[0].amount).toBe(100000) // capped at available
    expect(result.totalDistributed).toBe(100000)
  })

  it("Test 15: reserve tier retains amount from distribution", async () => {
    ;(mockPrisma.projectWaterfallConfig.findUnique as any).mockResolvedValue({
      id: "wf1", projectId: "proj1", enabled: true,
      preferredReturnAccrued: 0, capitalReturned: 0,
      tiers: [
        { name: "Reserve", type: "RESERVE", reservePercent: 0.10, priority: 1 },
        { name: "Profit Split", type: "PROFIT_SPLIT", lpPercent: 1.0, gpPercent: 0, priority: 2 },
      ],
    })

    const result = await calculateWaterfallDistribution("proj1", 1000000, 5000000)

    expect(result.totalReserved).toBe(100000) // 10% of 1M
    expect(result.tierResults[0].type).toBe("RESERVE")
  })
})
