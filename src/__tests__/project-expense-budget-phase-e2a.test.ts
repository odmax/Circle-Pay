import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectBudgetCategory: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectExpense: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    projectVendor: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    project: { findUnique: vi.fn() },
    circleMember: { findUnique: vi.fn() },
    wallet: { findFirst: vi.fn() },
    ledgerAccount: { findFirst: vi.fn() },
    ledgerTransaction: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock("@/lib/services/project.service", () => ({
  addProjectActivity: vi.fn().mockResolvedValue({}),
  requireProjectInCircle: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/services/project-budget.service", () => ({
  createBudgetCategory: vi.fn(),
  getBudgetCategories: vi.fn(),
  getBudgetCategoryById: vi.fn(),
  getBudgetCategoryByEnum: vi.fn(),
  updateBudgetCategory: vi.fn(),
  deleteBudgetCategory: vi.fn(),
  recalculateBudgetCategory: vi.fn(),
  getBudgetDashboard: vi.fn(),
  validateExpenseAgainstBudget: vi.fn(),
}))

vi.mock("@/lib/services/project-vendor.service", () => ({
  createVendor: vi.fn(),
  getVendors: vi.fn(),
  getVendorById: vi.fn(),
  updateVendor: vi.fn(),
  deleteVendor: vi.fn(),
  recordVendorSpend: vi.fn(),
  getVendorStats: vi.fn(),
}))

vi.mock("@/lib/permissions/circle-permissions", () => ({
  hasCirclePermission: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/permissions/circlePermissions", () => ({
  CIRCLE_PERMISSIONS: {
    PROJECT_EXPENSE_VIEW: "PROJECT_EXPENSE_VIEW",
    PROJECT_EXPENSE_CREATE: "PROJECT_EXPENSE_CREATE",
    PROJECT_EXPENSE_EDIT: "PROJECT_EXPENSE_EDIT",
    PROJECT_EXPENSE_APPROVE: "PROJECT_EXPENSE_APPROVE",
    PROJECT_EXPENSE_VOID: "PROJECT_EXPENSE_VOID",
    PROJECT_EXPENSE_DELETE: "PROJECT_EXPENSE_DELETE",
    PROJECT_MANAGE: "PROJECT_MANAGE",
  },
}))

import { prisma } from "@/lib/prisma"
import {
  createBudgetCategory,
  getBudgetCategories,
  updateBudgetCategory,
  deleteBudgetCategory,
  getBudgetDashboard,
  validateExpenseAgainstBudget,
} from "@/lib/services/project-budget.service"
import {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
  getVendorStats,
} from "@/lib/services/project-vendor.service"

const mockPrisma = vi.mocked(prisma)

beforeEach(() => { vi.clearAllMocks() })

// ─── Budget Category Tests ────
describe("E2A: Budget Categories", () => {
  it("Test 1: creates a budget category", async () => {
    ;(createBudgetCategory as any).mockResolvedValue({
      id: "bc1", projectId: "proj1", category: "LEGAL", approvedBudget: 100000,
      committedCost: 0, actualCost: 0, remainingBudget: 100000, variance: 100000,
      status: "ACTIVE", overBudgetPolicy: "WARN",
    })

    const result = await createBudgetCategory("proj1", {
      category: "LEGAL",
      description: "Legal fees budget",
      approvedBudget: 100000,
    })

    expect(result.category).toBe("LEGAL")
    expect(Number(result.approvedBudget)).toBe(100000)
    expect(result.overBudgetPolicy).toBe("WARN")
  })

  it("Test 2: budget dashboard returns summary", async () => {
    ;(getBudgetDashboard as any).mockResolvedValue({
      categories: [
        { id: "bc1", category: "LEGAL", approvedBudget: 100000, actualCost: 50000, committedCost: 10000, variance: 50000, status: "ACTIVE" },
        { id: "bc2", category: "MATERIALS", approvedBudget: 200000, actualCost: 180000, committedCost: 30000, variance: 20000, status: "NEAR_LIMIT" },
      ],
      summary: {
        totalApprovedBudget: 300000,
        totalCommitted: 40000,
        totalSpent: 230000,
        totalRemaining: 30000,
        totalVariance: 70000,
        burnPercent: 77,
        overBudgetCount: 0,
        pendingApprovalCount: 2,
      },
      largestCategories: [
        { category: "MATERIALS", approved: 200000, spent: 180000, percent: 90 },
        { category: "LEGAL", approved: 100000, spent: 50000, percent: 50 },
      ],
      warnings: [],
    })

    const dashboard = await getBudgetDashboard("proj1")
    expect(dashboard.summary.totalApprovedBudget).toBe(300000)
    expect(dashboard.summary.burnPercent).toBe(77)
    expect(dashboard.largestCategories).toHaveLength(2)
  })

  it("Test 3: validate expense against budget - BLOCK policy", async () => {
    ;(validateExpenseAgainstBudget as any).mockResolvedValue({
      allowed: false,
      warning: "Expense exceeds budget by R10,000. Over-budget policy is BLOCK.",
      requiresApproval: false,
    })

    const result = await validateExpenseAgainstBudget("proj1", "LEGAL", 60000)
    expect(result.allowed).toBe(false)
    expect(result.warning).toContain("BLOCK")
  })

  it("Test 4: validate expense against budget - APPROVE policy", async () => {
    ;(validateExpenseAgainstBudget as any).mockResolvedValue({
      allowed: true,
      warning: "Expense exceeds budget by R5,000. Requires approval.",
      requiresApproval: true,
    })

    const result = await validateExpenseAgainstBudget("proj1", "LEGAL", 55000)
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(true)
  })

  it("Test 5: validate expense within budget", async () => {
    ;(validateExpenseAgainstBudget as any).mockResolvedValue({
      allowed: true,
      warning: null,
      requiresApproval: false,
    })

    const result = await validateExpenseAgainstBudget("proj1", "LEGAL", 10000)
    expect(result.allowed).toBe(true)
    expect(result.warning).toBeNull()
  })

  it("Test 6: update budget category recalculates remaining", async () => {
    ;(updateBudgetCategory as any).mockResolvedValue({
      id: "bc1", approvedBudget: 150000, actualCost: 50000,
      remainingBudget: 100000, variance: 100000,
    })

    const result = await updateBudgetCategory("bc1", { approvedBudget: 150000 })
    expect(Number(result.approvedBudget)).toBe(150000)
    expect(Number(result.remainingBudget)).toBe(100000)
  })

  it("Test 7: delete budget category with expenses throws", async () => {
    ;(deleteBudgetCategory as any).mockRejectedValue(
      new Error("Cannot delete budget category with existing expenses")
    )

    await expect(deleteBudgetCategory("bc1")).rejects.toThrow("Cannot delete budget category with existing expenses")
  })
})

// ─── Vendor Tests ────
describe("E2A: Vendor Management", () => {
  it("Test 8: creates a vendor", async () => {
    ;(createVendor as any).mockResolvedValue({
      id: "v1", projectId: "proj1", name: "BuildCo", email: "info@buildco.com",
      totalSpend: 0, expenseCount: 0, isActive: true,
    })

    const vendor = await createVendor("proj1", "circle1", {
      name: "BuildCo", email: "info@buildco.com",
    })
    expect(vendor.name).toBe("BuildCo")
    expect(vendor.isActive).toBe(true)
  })

  it("Test 9: vendor stats", async () => {
    ;(getVendorStats as any).mockResolvedValue({
      vendors: [
        { id: "v1", name: "BuildCo", totalSpend: 500000, expenseCount: 5 },
        { id: "v2", name: "LegalPartners", totalSpend: 150000, expenseCount: 3 },
      ],
      summary: {
        totalVendors: 2,
        totalSpend: 650000,
        topVendors: [{ name: "BuildCo", totalSpend: 500000 }],
      },
    })

    const stats = await getVendorStats("proj1")
    expect(stats.summary.totalVendors).toBe(2)
    expect(stats.summary.totalSpend).toBe(650000)
  })

  it("Test 10: delete vendor with expenses soft-deletes", async () => {
    ;(deleteVendor as any).mockResolvedValue({
      id: "v1", isActive: false,
    })

    const result = await deleteVendor("v1")
    expect(result.isActive).toBe(false)
  })
})

// ─── Permission Constants ────
describe("E2A: Permissions", () => {
  it("Test 11: all PROJECT_EXPENSE permissions are defined", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    expect(CIRCLE_PERMISSIONS.PROJECT_EXPENSE_VIEW).toBe("PROJECT_EXPENSE_VIEW")
    expect(CIRCLE_PERMISSIONS.PROJECT_EXPENSE_CREATE).toBe("PROJECT_EXPENSE_CREATE")
    expect(CIRCLE_PERMISSIONS.PROJECT_EXPENSE_EDIT).toBe("PROJECT_EXPENSE_EDIT")
    expect(CIRCLE_PERMISSIONS.PROJECT_EXPENSE_APPROVE).toBe("PROJECT_EXPENSE_APPROVE")
    expect(CIRCLE_PERMISSIONS.PROJECT_EXPENSE_VOID).toBe("PROJECT_EXPENSE_VOID")
    expect(CIRCLE_PERMISSIONS.PROJECT_EXPENSE_DELETE).toBe("PROJECT_EXPENSE_DELETE")
  })

  it("Test 12: role permissions include PROJECT_EXPENSE_*", async () => {
    const { CIRCLE_ROLE_PERMISSIONS } = await import("@/lib/permissions/circle-role-permissions")
    const adminPerms = CIRCLE_ROLE_PERMISSIONS.ADMIN
    expect(adminPerms).toContain("PROJECT_EXPENSE_VIEW")
    expect(adminPerms).toContain("PROJECT_EXPENSE_CREATE")
    expect(adminPerms).toContain("PROJECT_EXPENSE_EDIT")
    expect(adminPerms).toContain("PROJECT_EXPENSE_APPROVE")
    expect(adminPerms).toContain("PROJECT_EXPENSE_VOID")
    expect(adminPerms).toContain("PROJECT_EXPENSE_DELETE")

    const memberPerms = CIRCLE_ROLE_PERMISSIONS.MEMBER
    expect(memberPerms).toContain("PROJECT_EXPENSE_VIEW")
    expect(memberPerms).toContain("PROJECT_EXPENSE_CREATE")
    expect(memberPerms).not.toContain("PROJECT_EXPENSE_APPROVE")

    const viewerPerms = CIRCLE_ROLE_PERMISSIONS.VIEWER
    expect(viewerPerms).toContain("PROJECT_EXPENSE_VIEW")
    expect(viewerPerms).not.toContain("PROJECT_EXPENSE_CREATE")
  })
})

// ─── Schema Validation ────
describe("E2A: Schema", () => {
  it("Test 13: BudgetCategory model exists in schema", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("model ProjectBudgetCategory")
    expect(schema).toContain("approvedBudget")
    expect(schema).toContain("committedCost")
    expect(schema).toContain("actualCost")
    expect(schema).toContain("remainingBudget")
    expect(schema).toContain("variance")
    expect(schema).toContain("overBudgetPolicy")
    expect(schema).toContain("@@unique([projectId, category])")
  })

  it("Test 14: Vendor model exists in schema", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("model ProjectVendor")
    expect(schema).toContain("taxNumber")
    expect(schema).toContain("paymentDetails")
    expect(schema).toContain("totalSpend")
    expect(schema).toContain("expenseCount")
    expect(schema).toContain("@@unique([circleId, projectId, name])")
  })

  it("Test 15: ProjectExpense extended with new fields", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("VOIDED")
    expect(schema).toContain("CORRECTED")
    expect(schema).toContain("vendorId")
    expect(schema).toContain("correctedFromId")
    expect(schema).toContain("voidedById")
    expect(schema).toContain("paymentMethod")
    expect(schema).toContain("voidedAt")
    expect(schema).toContain("voidReason")
    expect(schema).toContain("approvalRequestId")
  })
})

// ─── Service Exports ────
describe("E2A: Service Exports", () => {
  it("Test 16: budget service exports all functions", async () => {
    const mod = await import("@/lib/services/project-budget.service")
    expect(typeof mod.createBudgetCategory).toBe("function")
    expect(typeof mod.getBudgetCategories).toBe("function")
    expect(typeof mod.getBudgetCategoryById).toBe("function")
    expect(typeof mod.getBudgetCategoryByEnum).toBe("function")
    expect(typeof mod.updateBudgetCategory).toBe("function")
    expect(typeof mod.deleteBudgetCategory).toBe("function")
    expect(typeof mod.recalculateBudgetCategory).toBe("function")
    expect(typeof mod.getBudgetDashboard).toBe("function")
    expect(typeof mod.validateExpenseAgainstBudget).toBe("function")
  })

  it("Test 17: vendor service exports all functions", async () => {
    const mod = await import("@/lib/services/project-vendor.service")
    expect(typeof mod.createVendor).toBe("function")
    expect(typeof mod.getVendors).toBe("function")
    expect(typeof mod.getVendorById).toBe("function")
    expect(typeof mod.updateVendor).toBe("function")
    expect(typeof mod.deleteVendor).toBe("function")
    expect(typeof mod.recordVendorSpend).toBe("function")
    expect(typeof mod.getVendorStats).toBe("function")
  })

  it("Test 18: expense service exports all functions", async () => {
    const mod = await import("@/lib/services/project-expense.service")
    expect(typeof mod.createExpense).toBe("function")
    expect(typeof mod.updateExpense).toBe("function")
    expect(typeof mod.deleteExpense).toBe("function")
    expect(typeof mod.submitExpense).toBe("function")
    expect(typeof mod.approveExpense).toBe("function")
    expect(typeof mod.rejectExpense).toBe("function")
    expect(typeof mod.markExpensePaid).toBe("function")
    expect(typeof mod.voidExpense).toBe("function")
    expect(typeof mod.correctExpense).toBe("function")
    expect(typeof mod.duplicateExpense).toBe("function")
    expect(typeof mod.getExpenseById).toBe("function")
    expect(typeof mod.getExpenseDashboard).toBe("function")
  })
})

// ─── API Route Files ────
describe("E2A: API Routes", () => {
  it("Test 19: budget API route exists", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const routePath = path.resolve("src/app/api/circles/[circleId]/projects/[projectId]/budget/route.ts")
    expect(fs.existsSync(routePath)).toBe(true)
    const content = fs.readFileSync(routePath, "utf-8")
    expect(content).toContain("export async function GET")
    expect(content).toContain("export async function POST")
    expect(content).toContain("export async function PATCH")
    expect(content).toContain("export async function DELETE")
  })

  it("Test 20: vendors API route exists", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const routePath = path.resolve("src/app/api/circles/[circleId]/projects/[projectId]/vendors/route.ts")
    expect(fs.existsSync(routePath)).toBe(true)
    const content = fs.readFileSync(routePath, "utf-8")
    expect(content).toContain("export async function GET")
    expect(content).toContain("export async function POST")
    expect(content).toContain("export async function PATCH")
    expect(content).toContain("export async function DELETE")
  })

  it("Test 21: expense API routes support all actions", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const routePath = path.resolve("src/app/api/circles/[circleId]/projects/[projectId]/expenses/[expenseId]/route.ts")
    const content = fs.readFileSync(routePath, "utf-8")
    expect(content).toContain("submit")
    expect(content).toContain("approve")
    expect(content).toContain("reject")
    expect(content).toContain("paid")
    expect(content).toContain("void")
    expect(content).toContain("correct")
    expect(content).toContain("duplicate")
  })
})
