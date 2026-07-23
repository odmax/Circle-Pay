import { describe, it, expect, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ─── Test 1: formatCurrency ────
describe("E1: Shared Utilities", () => {
  it("Test 1: formatCurrency resolves correct symbol", async () => {
    const { formatCurrency } = await import("@/components/projects/types")
    expect(formatCurrency(500000, "ZAR")).toContain("R")
    expect(formatCurrency(500000, "NGN")).toContain("₦")
    expect(formatCurrency(500000, "USD")).toContain("$")
    expect(formatCurrency(500000, "GBP")).toContain("£")
  })

  it("Test 2: formatCurrency falls back to R for unknown", async () => {
    const { formatCurrency } = await import("@/components/projects/types")
    expect(formatCurrency(1000, "UNKNOWN")).toContain("R")
  })

  it("Test 3: formatDate returns formatted date", async () => {
    const { formatDate } = await import("@/components/projects/types")
    const result = formatDate("2026-01-15")
    expect(result).toBeTruthy()
    expect(typeof result).toBe("string")
  })
})

// ─── Test 4: Status color maps ────
describe("E1: Status Colors", () => {
  it("Test 4: PROJECT_STATUS_COLORS covers all statuses", async () => {
    const { PROJECT_STATUS_COLORS } = await import("@/components/projects/types")
    const statuses = ["DRAFT", "FUNDING_SETUP", "FUNDING_OPEN", "PARTIALLY_FUNDED", "FULLY_FUNDED", "ACTIVE", "REVENUE_GENERATING", "COMPLETED", "CLOSED", "SUSPENDED", "CANCELLED", "FAILED"]
    for (const s of statuses) {
      expect(PROJECT_STATUS_COLORS[s]).toBeTruthy()
    }
  })

  it("Test 5: ROUND_STATUS_COLORS covers round statuses", async () => {
    const { ROUND_STATUS_COLORS } = await import("@/components/projects/types")
    expect(ROUND_STATUS_COLORS["DRAFT"]).toBeTruthy()
    expect(ROUND_STATUS_COLORS["OPEN"]).toBeTruthy()
    expect(ROUND_STATUS_COLORS["CLOSED"]).toBeTruthy()
  })

  it("Test 6: CAPITAL_CLASSIFICATION_LABELS has all classifications", async () => {
    const { CAPITAL_CLASSIFICATION_LABELS } = await import("@/components/projects/types")
    expect(Object.keys(CAPITAL_CLASSIFICATION_LABELS)).toContain("REQUIRED_EQUITY")
    expect(Object.keys(CAPITAL_CLASSIFICATION_LABELS)).toContain("DONATION")
    expect(Object.keys(CAPITAL_CLASSIFICATION_LABELS)).toContain("EXTERNAL_INVESTMENT")
    expect(Object.keys(CAPITAL_CLASSIFICATION_LABELS)).toHaveLength(8)
  })
})

// ─── Test 7: Component exports ────
describe("E1: Component Exports", () => {
  it("Test 7: ProjectHeader exports correctly", async () => {
    const mod = await import("@/components/projects/project-header")
    expect(typeof mod.ProjectHeader).toBe("function")
  })

  it("Test 8: ProjectTabs exports correctly", async () => {
    const mod = await import("@/components/projects/project-tabs")
    expect(typeof mod.ProjectTabs).toBe("function")
  })

  it("Test 9: OverviewTab exports correctly", async () => {
    const mod = await import("@/components/projects/overview/overview-tab")
    expect(typeof mod.OverviewTab).toBe("function")
  })

  it("Test 10: FundingTab exports correctly", async () => {
    const mod = await import("@/components/projects/funding/funding-tab")
    expect(typeof mod.FundingTab).toBe("function")
  })

  it("Test 11: ContributionsTab exports correctly", async () => {
    const mod = await import("@/components/projects/contributions/contributions-tab")
    expect(typeof mod.ContributionsTab).toBe("function")
  })

  it("Test 12: ShortfallTab exports correctly", async () => {
    const mod = await import("@/components/projects/shortfall/shortfall-tab")
    expect(typeof mod.ShortfallTab).toBe("function")
  })
})

// ─── Test 13: useProjectData hook ────
describe("E1: useProjectData Hook", () => {
  it("Test 13: useProjectData exports correctly", async () => {
    const mod = await import("@/components/projects/use-project-data")
    expect(typeof mod.useProjectData).toBe("function")
  })
})

// ─── Test 14: Types export correctly ────
describe("E1: Type Interfaces", () => {
  it("Test 14: ProjectData type is exported", async () => {
    const mod = await import("@/components/projects/types")
    expect(mod).toHaveProperty("formatCurrency")
    expect(mod).toHaveProperty("formatDate")
    expect(mod).toHaveProperty("formatDateTime")
    expect(mod).toHaveProperty("formatPercent")
    expect(mod).toHaveProperty("PROJECT_STATUS_COLORS")
    expect(mod).toHaveProperty("ROUND_STATUS_COLORS")
    expect(mod).toHaveProperty("CAPITAL_TX_STATUS_COLORS")
    expect(mod).toHaveProperty("CAPITAL_CLASSIFICATION_LABELS")
    expect(mod).toHaveProperty("EXPENSE_CATEGORY_COLORS")
  })
})
