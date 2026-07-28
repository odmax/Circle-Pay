import { describe, it, expect } from "vitest"

describe("Performance: Component Tree", () => {
  it("Test P1: project-context exports memoized value", async () => {
    const mod = await import("@/components/projects/project-context")
    expect(typeof mod.useProjectContext).toBe("function")
    expect(typeof mod.ProjectProvider).toBe("function")
  })

  it("Test P2: all tab components export correctly", async () => {
    const tabs = [
      { path: "@/components/projects/assets/assets-tab", name: "AssetsTab" },
      { path: "@/components/projects/revenue/revenue-tab", name: "RevenueTab" },
      { path: "@/components/projects/roi/roi-tab", name: "ROITab" },
      { path: "@/components/projects/ownership/ownership-tab", name: "OwnershipTab" },
      { path: "@/components/projects/distributions/distributions-tab", name: "DistributionsTab" },
      { path: "@/components/projects/statements/statements-tab", name: "StatementsTab" },
      { path: "@/components/projects/reports/reports-tab", name: "ReportsTab" },
      { path: "@/components/projects/timeline/timeline-tab", name: "TimelineTab" },
      { path: "@/components/projects/funding/funding-tab", name: "FundingTab" },
      { path: "@/components/projects/contributions/contributions-tab", name: "ContributionsTab" },
      { path: "@/components/projects/shortfall/shortfall-tab", name: "ShortfallTab" },
      { path: "@/components/projects/overview/overview-tab", name: "OverviewTab" },
      { path: "@/components/projects/expenses/expenses-tab", name: "ExpensesTab" },
    ]
    for (const t of tabs) {
      const mod = await import(t.path)
      expect(typeof mod[t.name]).toBe("function")
    }
  })

  it("Test P3: useCallback used in funding tab fetch", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/funding/funding-tab.tsx"), "utf-8")
    expect(src).toContain("useCallback")
    expect(src).toContain("fetchRounds")
  })

  it("Test P4: useCallback used in contributions tab", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/contributions/contributions-tab.tsx"), "utf-8")
    expect(src).toContain("useCallback")
    expect(src).toContain("fetchTransactions")
    expect(src).toContain("useMemo")
  })

  it("Test P5: useCallback used in shortfall tab", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/shortfall/shortfall-tab.tsx"), "utf-8")
    expect(src).toContain("useCallback")
    expect(src).toContain("fetchShortfalls")
  })

  it("Test P6: useMemo context value in project-context", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/project-context.tsx"), "utf-8")
    expect(src).toContain("useMemo")
  })

  it("Test P7: ActivityIcon extracted from timeline IIFE", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/timeline/timeline-tab.tsx"), "utf-8")
    expect(src).toContain("function ActivityIcon")
    // Should NOT contain the old IIFE pattern
    expect(src).not.toContain("(() => { const Icon =")
  })

  it("Test P8: useState ordering fixed in contributions tab", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/contributions/contributions-tab.tsx"), "utf-8")
    const proofRefIndex = src.indexOf("proofReference, setProofReference")
    const fetchFnIndex = src.indexOf("fetchTransactions = useCallback")
    expect(proofRefIndex).toBeGreaterThan(-1)
    expect(fetchFnIndex).toBeGreaterThan(-1)
    expect(proofRefIndex).toBeLessThan(fetchFnIndex)
  })

  it("Test P9: new API route files exist on disk", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const routes = [
      "src/app/api/circles/[circleId]/projects/[projectId]/activities/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/reports/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/overview-summary/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/assets/route.ts",
    ]
    for (const r of routes) {
      expect(fs.existsSync(path.resolve(r))).toBe(true)
    }
  })

  it("Test P10: no placeholder exports remain", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/projects/placeholder-tabs.tsx"), "utf-8")
    expect(src).not.toContain("makePlaceholder")
  })
})
