import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectExpense: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    projectAsset: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    projectRevenue: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    project: { findUnique: vi.fn(), update: vi.fn() },
    wallet: { findFirst: vi.fn() },
    ledgerAccount: { findFirst: vi.fn() },
    ledgerTransaction: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock("@/lib/services/project.service", () => ({
  addProjectActivity: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/services/wallet.service", () => ({
  recordInvestmentAssetToLedger: vi.fn().mockResolvedValue({}),
  recordInvestmentReturnToLedger: vi.fn().mockResolvedValue({}),
}))

import { prisma } from "@/lib/prisma"
import { createProjectExpense, getProjectExpenseDashboard } from "@/lib/services/project-expense.service"
import { createProjectAsset, calculateAssetDepreciation } from "@/lib/services/project-roi.service"
import { createProjectRevenue } from "@/lib/services/project-roi.service"

const mockPrisma = vi.mocked(prisma)

beforeEach(() => { vi.clearAllMocks() })

// ─── Test 1: Expense with budget amount ────
describe("Phase C: Expenses with Budget", () => {
  it("Test 1: creates expense with budget and vendor contact", async () => {
    ;(mockPrisma.projectExpense.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "exp1", ...args.data })
    )

    const result = await createProjectExpense("proj1", "circle1", "user1", {
      title: "Legal fees", amount: 50000, category: "LEGAL",
      vendorName: "Law Firm Inc", vendorContact: "info@lawfirm.com",
      budgetAmount: 45000,
    })

    expect(result.budgetAmount).toBe(45000)
    expect(result.vendorContact).toBe("info@lawfirm.com")
  })

  it("Test 2: expense dashboard includes budget variance", async () => {
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([
      { id: "e1", category: "LEGAL", amount: 50000, budgetAmount: 45000, status: "PAID" },
      { id: "e2", category: "LEGAL", amount: 10000, budgetAmount: 5000, status: "PAID" },
      { id: "e3", category: "MATERIALS", amount: 30000, budgetAmount: 30000, status: "APPROVED" },
    ])
    ;(mockPrisma.project.findUnique as any).mockResolvedValue({ currentAmount: 200000 })

    const dashboard = await getProjectExpenseDashboard("proj1")

    expect(dashboard.summary.budgetByCategory).toHaveProperty("LEGAL")
    expect(dashboard.summary.budgetByCategory.LEGAL.budgeted).toBe(50000) // 45000 + 5000
    expect(dashboard.summary.budgetByCategory.LEGAL.spent).toBe(60000) // 50000 + 10000
    expect(dashboard.summary.budgetByCategory.LEGAL.variance).toBe(-10000) // over budget

    expect(dashboard.warnings.length).toBeGreaterThan(0)
    expect(dashboard.warnings[0]).toContain("LEGAL")
  })
})

// ─── Test 3: Revenue gross vs net ────
describe("Phase C: Revenue Gross/Net", () => {
  it("Test 3: creates revenue with gross, direct costs, and net", async () => {
    ;(mockPrisma.projectRevenue.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "rev1", ...args.data })
    )

    const result = await createProjectRevenue("proj1", "circle1", "user1", {
      amount: 80000, grossAmount: 100000, directCosts: 20000,
      description: "Product sales",
    })

    expect(result.grossAmount).toBe(100000)
    expect(result.directCosts).toBe(20000)
    expect(result.amount).toBe(80000) // net
  })

  it("Test 4: rejects revenue where costs exceed gross", async () => {
    await expect(
      createProjectRevenue("proj1", "circle1", "user1", {
        amount: 100000, grossAmount: 50000, directCosts: 60000,
      })
    ).rejects.toThrow("Net amount cannot be negative")
  })
})

// ─── Test 5: Asset depreciation ────
describe("Phase C: Asset Depreciation", () => {
  it("Test 5: straight-line depreciation calculates correctly", async () => {
    const purchaseDate = new Date("2024-01-01")
    const now = new Date()
    const monthsElapsed = (now.getFullYear() - 2024) * 12 + (now.getMonth())

    ;(mockPrisma.projectAsset.findUnique as any).mockResolvedValue({
      id: "asset1", name: "Vehicle",
      purchaseAmount: 500000, currentValue: 500000,
      depreciationMethod: "STRAIGHT_LINE",
      depreciationRate: 0.20, // 20% per year
      depreciationStartDate: purchaseDate,
      accumulatedDepreciation: 0,
    })

    const result = await calculateAssetDepreciation("asset1")

    // Expected: 500000 * 0.20 * (monthsElapsed/12)
    const expectedYears = monthsElapsed / 12
    const expected = 500000 * 0.20 * expectedYears
    expect(result.depreciation).toBeCloseTo(expected, 0)
    expect(result.newCurrentValue).toBeCloseTo(500000 - expected, 0)
  })

  it("Test 6: no depreciation if method is NONE", async () => {
    ;(mockPrisma.projectAsset.findUnique as any).mockResolvedValue({
      id: "asset2", name: "Land",
      depreciationMethod: "NONE",
      purchaseAmount: 1000000,
      currentValue: 1000000,
      accumulatedDepreciation: 0,
    })

    const result = await calculateAssetDepreciation("asset2")
    expect(result.depreciation).toBe(0)
  })
})

// ─── Test 7: ROI summary structure ────
describe("Phase C: ROI Dashboard", () => {
  it("Test 7: dashboard includes gross/net revenue breakdown", async () => {
    ;(mockPrisma.project.findUnique as any).mockResolvedValue({ currentAmount: 1000000 })
    ;(mockPrisma.projectExpense.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectAsset.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectRevenue.findMany as any).mockResolvedValue([
      { amount: 80000, grossAmount: 100000, directCosts: 20000, type: "SALE", asset: null, description: null, revenueDate: null, status: "CONFIRMED" },
      { amount: 30000, grossAmount: 30000, directCosts: 0, type: "RENTAL_INCOME", asset: null, description: null, revenueDate: null, status: "CONFIRMED" },
    ])

    const { getProjectROIDashboard } = await import("@/lib/services/project-roi.service")
    const dashboard = await getProjectROIDashboard("proj1")

    expect(dashboard.summary.totalRevenueGross).toBe(130000)
    expect(dashboard.summary.totalDirectCosts).toBe(20000)
    expect(dashboard.summary.totalRevenueNet).toBe(110000)
  })
})

// ─── Test 8: Asset creation with custodian and depreciation ────
describe("Phase C: Asset with Metadata", () => {
  it("Test 8: creates asset with custodian, location, and depreciation config", async () => {
    ;(mockPrisma.projectAsset.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "asset3", ...args.data })
    )

    const result = await createProjectAsset("proj1", "circle1", "user1", {
      name: "Office Equipment", type: "EQUIPMENT", purchaseAmount: 100000,
      custodianId: "user2", location: "Main Office",
      depreciationMethod: "STRAIGHT_LINE", depreciationRate: 0.25,
      depreciationStartDate: new Date("2024-01-01"),
    })

    expect(result.custodianId).toBe("user2")
    expect(result.location).toBe("Main Office")
    expect(result.depreciationMethod).toBe("STRAIGHT_LINE")
    expect(result.depreciationRate).toBe(0.25)
    expect(result.status).toBe("PURCHASED")
  })
})
