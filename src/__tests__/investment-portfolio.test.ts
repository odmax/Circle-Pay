import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { computePortfolioAlerts, computeMonthlySeries, computeRoi } from "@/lib/services/project-investment-metrics"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const portfolioSvc = readFile("src/lib/services/portfolio.service.ts")
const metrics = readFile("src/lib/services/project-investment-metrics.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/portfolio/page.tsx")
const dashboard = readFile("src/components/portfolio/portfolio-dashboard.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")
const circleOverviewPage = readFile("src/app/(dashboard)/circles/[circleId]/page.tsx")

describe("Portfolio Alerts — Pure Alert Engine", () => {
  const baseProject = {
    id: "p1",
    name: "Alpha",
    status: "ACTIVE",
    fundingPercent: 100,
    funded: 1000,
    target: 1000,
    netProfit: 100,
    revenue: 500,
    expenses: 100,
    pendingApprovals: 0,
  }

  it("PF1: flags a funding shortfall for partially funded rounds", () => {
    const alerts = computePortfolioAlerts({ projects: [{ ...baseProject, status: "PARTIALLY_FUNDED", fundingPercent: 40 }] })
    expect(alerts.some((a) => a.title.includes("funding shortfall") && a.level === "warning")).toBe(true)
  })

  it("PF2: flags loss-making projects at risk level", () => {
    const alerts = computePortfolioAlerts({ projects: [{ ...baseProject, netProfit: -250 }] })
    expect(alerts.some((a) => a.title.includes("operating at a loss") && a.level === "risk")).toBe(true)
  })

  it("PF3: flags over-budget, pending approvals and missing financial data", () => {
    const alerts = computePortfolioAlerts({
      projects: [
        baseProject,
        { ...baseProject, id: "p2", name: "Beta", pendingApprovals: 3 },
        { ...baseProject, id: "p3", name: "Gamma", revenue: 0, expenses: 0 },
      ],
      overBudgetProjectIds: ["p1"],
    })
    expect(alerts.some((a) => a.title.includes("over budget"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("approvals pending"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("missing financial data"))).toBe(true)
  })

  it("PF4: flags distribution due and month-over-month revenue decline", () => {
    const now = new Date()
    const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 5)
    const m2 = new Date(now.getFullYear(), now.getMonth(), 5)
    const monthly = computeMonthlySeries(
      [{ date: m1, amount: 1000 }, { date: m2, amount: 100 }],
      [],
      6,
    )
    const alerts = computePortfolioAlerts({
      projects: [],
      monthly,
      upcomingDistributions: [{ id: "d1", projectId: "p1", name: "Payout", amount: 1500, status: "APPROVED" }],
    })
    expect(alerts.some((a) => a.title.includes("revenue decline"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Distribution due"))).toBe(true)
  })

  it("PF5: healthy portfolio with no projects produces no alerts", () => {
    expect(computePortfolioAlerts({ projects: [] })).toHaveLength(0)
  })
})

describe("Portfolio Service — Composition & No Duplicated Math", () => {
  it("PF6: reuses the project summary engine instead of re-adding money math", () => {
    expect(portfolioSvc).toContain("getProjectInvestmentSummaries(circleId, viewerUserId)")
    expect(portfolioSvc).not.toContain("Math.round((")
  })

  it("PF7: reuses the pure metrics helpers for ROI, monthly series and alerts", () => {
    expect(portfolioSvc).toContain("computeRoi(netProfit,")
    expect(portfolioSvc).toContain("computeMonthlySeries(")
    expect(portfolioSvc).toContain("computeRoiTrend(monthly,")
    expect(portfolioSvc).toContain("computePortfolioAlerts({")
    expect(metrics).toContain("export function computePortfolioAlerts")
  })

  it("PF8: all portfolio queries are scoped to the circle's projects (cross-circle isolation)", () => {
    expect(portfolioSvc).toContain('projectId: { in: projectIds }')
    expect(portfolioSvc).toContain("getProjectInvestmentSummaries(circleId, viewerUserId)")
  })
})

describe("Portfolio Security — Members Only", () => {
  it("PF9: the page requires circle membership via getCircleById (notFound on denial)", () => {
    expect(page).toContain("getCircleById(circleId, session.user.id)")
    expect(page).toContain("notFound()")
  })

  it("PF10: my investment position derives only from the viewer's own records", () => {
    expect(portfolioSvc).toContain("viewerUserId")
    expect(portfolioSvc).toContain("items: { some: { userId: viewerUserId } }")
    expect(portfolioSvc).toContain('p.myCapital > 0')
    expect(portfolioSvc).toContain("p.myOwnershipPercent")
  })

  it("PF11: member data is not hard-coded to roles and uses no role checks", () => {
    expect(portfolioSvc).not.toContain("isOwner")
    expect(portfolioSvc).not.toContain("userRole")
  })
})

describe("Portfolio Surface — Navigation & UI", () => {
  it("PF12: adds the Portfolio tab to circle navigations", () => {
    expect(circleTypes).toContain('label: "Portfolio", icon: "Gauge", href: "/portfolio"')
    expect(circleTypes).toContain("tabs.portfolio")
  })

  it("PF13: the circle dashboard resolves the Gauge tab icon", () => {
    expect(circleOverviewPage).toContain("Gauge")
  })

  it("PF14: portfolio metrics include capital, value, revenue, expenses, profit, ROI, projects, investors, approvals, distributions", () => {
    for (const label of ["Capital Invested", "Portfolio Value", "Total Revenue", "Total Expenses", "Net Profit", "Overall ROI", "Active Projects", "Total Investors", "Pending Approvals", "Upcoming Distributions"]) {
      expect(dashboard).toContain(`label="${label}"`)
    }
  })

  it("PF15: member position panel covers invested, value, P/L, ROI, ownership, distributions, active investments", () => {
    for (const label of ["Total Invested", "Current Value", "Profit / Loss", "Overall ROI", "Ownership Across Projects", "Distributions Received", "Pending Distributions", "Active Investments"]) {
      expect(dashboard).toContain(`label="${label}"`)
    }
    expect(dashboard).toContain("Your Investment Position")
  })

  it("PF16: performance charts for value trend, revenue/expense, ROI trend, allocation and comparison", () => {
    for (const title of ["Portfolio Value Trend", "Revenue vs Expenses", "Portfolio ROI Trend", "Capital Allocation by Project", "Project Performance Comparison"]) {
      expect(dashboard).toContain(title)
    }
    expect(dashboard).toContain("Best performing")
    expect(dashboard).toContain("Worst performing")
  })

  it("PF17: project portfolio rows expose funding %, capital, value, profit, ROI, health, ownership and next distribution", () => {
    for (const item of ["Funding ", "Capital", "Value", "Profit", "ROI", "investors", "You own", "Next distribution", "Quick View", "Invest"]) {
      expect(dashboard).toContain(item)
    }
  })

  it("PF18: alerts + unified investment activity sections exist", () => {
    expect(dashboard).toContain(" Alerts<")
    expect(dashboard).toContain("Investment Activity")
    expect(dashboard).toContain("Portfolio looks healthy")
  })

  it("PF19: empty and error states exist with consistent formatting", () => {
    expect(dashboard).toContain("No projects yet")
    expect(dashboard).toContain("PortfolioErrorState")
  })
})