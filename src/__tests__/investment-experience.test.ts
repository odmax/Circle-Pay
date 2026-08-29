import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
  computeFundingProgress,
  computeOwnershipPercent,
  computeProjectHealth,
  projectFilterTags,
  computeMonthlySeries,
  computeRoiTrend,
  computeRoi,
} from "@/lib/services/project-investment-metrics"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(relativePath))
}

const investSvc = readFile("src/lib/services/project-investment.service.ts")
const capitalSvc = readFile("src/lib/services/project-capital.service.ts")
const capitalRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/capital/route.ts")
const capitalProofRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/capital/[txId]/proof/route.ts")
const contributionProofRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/contributions/[contributionId]/route.ts")
const dashboardRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investment-dashboard/route.ts")
const updatesRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/updates/route.ts")
const memberStatementRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/member-statement/route.ts")
const pdfGenerator = readFile("src/lib/receipt/pdf-project-statement-generator.ts")
const schema = readFile("prisma/schema.prisma")
const listPage = readFile("src/app/(dashboard)/circles/[circleId]/projects/page.tsx")
const listClient = readFile("src/components/projects/list/project-list-client.tsx")
const overviewTab = readFile("src/components/projects/overview/overview-tab.tsx")
const investDialog = readFile("src/components/projects/invest-dialog.tsx")

describe("Investment Metrics — Pure Functions", () => {
  it("IM1: funding progress caps at 100% and computes the funding gap", () => {
    expect(computeFundingProgress(500, 1000)).toEqual({ funded: 500, target: 1000, percent: 50, gap: 500 })
    expect(computeFundingProgress(1500, 1000).percent).toBe(100)
    expect(computeFundingProgress(0, 0).gap).toBe(0)
  })

  it("IM2: ownership percent is contribution-weighted and guarded against zero", () => {
    expect(computeOwnershipPercent(250, 1000)).toBeCloseTo(25, 2)
    expect(computeOwnershipPercent(0, 1000)).toBe(0)
    expect(computeOwnershipPercent(500, 0)).toBe(0)
  })

  it("IM3: ROI is net-profit over raised capital", () => {
    expect(computeRoi(200, 1000)).toBe(20)
    expect(computeRoi(100, 0)).toBe(0)
  })

  it("IM4: health tiers — loss → risk, pending approvals → watch, funded active → healthy", () => {
    const base = { status: "ACTIVE", fundingPercent: 80, pendingApprovals: 0, netProfit: 100, expenses: 50, hasOverBudget: false }
    expect(computeProjectHealth(base)).toBe("healthy")
    expect(computeProjectHealth({ ...base, netProfit: -10 })).toBe("risk")
    expect(computeProjectHealth({ ...base, pendingApprovals: 2 })).toBe("watch")
    expect(computeProjectHealth({ ...base, hasOverBudget: true })).toBe("risk")
    expect(computeProjectHealth({ ...base, status: "FAILED" })).toBe("risk")
    expect(computeProjectHealth({ ...base, status: "FUNDING_OPEN", fundingPercent: 0 })).toBe("watch")
  })

  it("IM5: filter tags classify projects into Active/Funding/Operating/Profitable/Completed", () => {
    expect(projectFilterTags({ status: "FUNDING_OPEN", netProfit: 0, fundingPercent: 20 })).toContain("funding")
    expect(projectFilterTags({ status: "REVENUE_GENERATING", netProfit: 5000, fundingPercent: 100 })).toEqual(expect.arrayContaining(["active", "operating", "profitable"]))
    expect(projectFilterTags({ status: "COMPLETED", netProfit: 100, fundingPercent: 100 })).toContain("completed")
    expect(projectFilterTags({ status: "DRAFT", netProfit: 0, fundingPercent: 0 })).not.toContain("operating")
  })

  it("IM6: monthly series builds revenue/expense/cash-flow buckets across 6 months", () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10)
    const series = computeMonthlySeries(
      [{ date: thisMonth, amount: 1000 }],
      [{ date: thisMonth, amount: 400 }],
      6,
    )
    expect(series).toHaveLength(6)
    const last = series[series.length - 1]
    expect(last.revenue).toBe(1000)
    expect(last.expense).toBe(400)
    expect(last.net).toBe(600)
  })

  it("IM7: ROI trend accumulates net cash flow against raised capital", () => {
    const points = [
      { key: "a", label: "A", revenue: 1000, expense: 500, net: 500 },
      { key: "b", label: "B", revenue: 500, expense: 0, net: 500 },
    ]
    const trend = computeRoiTrend(points, 5000)
    expect(trend[0].roi).toBe(10)
    expect(trend[1].roi).toBe(20)
    expect(trend[1].net).toBe(1000)
  })
})

describe("Investment Experience — Security Guardrails", () => {
  it("IX1: capital proof upload is scoped to the project's circle (cross-circle blocked)", () => {
    expect(capitalProofRoute).toContain("requireProjectInCircle(projectId, circleId)")
    expect(capitalProofRoute).toContain("tx.projectId !== projectId")
  })

  it("IX2: members can only submit proof for their own transaction", () => {
    expect(capitalProofRoute).toContain("You can only submit proof for your own transaction")
    expect(capitalProofRoute).toContain("participant.userId && tx.participant.userId !== s.user.id")
    expect(capitalSvc).toContain("You can only submit proof for your own transaction")
    expect(capitalSvc).toContain("tx.participant.userId !== userId")
  })

  it("IX3: a member cannot approve their own restricted transaction", () => {
    expect(capitalRoute).toContain("You cannot approve your own transaction")
    expect(capitalRoute).toContain("participant.userId === s.user.id")
    expect(capitalRoute).toContain("CIRCLE_PERMISSIONS.FUNDING_RECORD")
    expect(capitalRoute).toContain("CIRCLE_PERMISSIONS.PROJECT_APPROVE")
  })

  it("IX4: confirm/reject require the FUNDING_RECORD permission (workflows intact)", () => {
    expect(capitalRoute).toContain('permission: CIRCLE_PERMISSIONS.FUNDING_RECORD')
    expect(capitalRoute).toContain("confirmCapitalTransaction(body.txId, s.user.id)")
    expect(capitalRoute).toContain("rejectCapitalTransaction(body.txId, s.user.id, body.reason)")
  })

  it("IX5: publishing an update requires PROJECT_MANAGE (permission-based, no hardcoded roles)", () => {
    expect(updatesRoute).toContain('permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE')
    expect(updatesRoute).not.toContain("isOwner")
    expect(updatesRoute).toContain("requireProjectInCircle(projectId, circleId)")
  })

  it("IX6: the investment dashboard is member-scoped (cross-circle + per-user portfolio)", () => {
    expect(dashboardRoute).toContain("requireProjectInCircle(projectId, circleId)")
    expect(investSvc).toContain("viewerUserId")
    expect(investSvc).toContain("contribs.filter((c) => c.userId === viewerUserId)")
  })
})

describe("Investment Experience — Real Proof Uploads", () => {
  it("IX7: capital proof upload accepts real files via the shared upload infra", () => {
    expect(capitalProofRoute).toContain("validateProofFile")
    expect(capitalProofRoute).toContain("uploadProofImage")
    expect(capitalProofRoute).toContain("multipart/form-data")
  })

  it("IX8: contribution proof upload also accepts files + keeps reference", () => {
    expect(contributionProofRoute).toContain("validateProofFile")
    expect(contributionProofRoute).toContain("uploadProofImage")
    expect(contributionProofRoute).toContain("multipart/form-data")
    expect(capitalSvc).toContain("proofUrl: props?.proofUrl || tx.proofUrl")
  })

  it("IX9: the Invest dialog commits capital then uploads a live proof file", () => {
    expect(investDialog).toContain("capital?action=record")
    expect(investDialog).toContain("capital/")
    expect(investDialog).toContain("/proof")
    expect(investDialog).toContain("type=\"file\"")
    expect(investDialog).toContain("new FormData()")
    expect(investDialog).toContain("max 5MB")
  })
})

describe("Investment Experience — Member & Admin Surface", () => {
  it("IX10: the projects list uses the live investment summary service", () => {
    expect(listPage).toContain("getProjectInvestmentSummaries(circleId, session.user.id)")
    expect(listPage).toContain("ProjectListClient")
  })

  it("IX11: the list offers the requested filters", () => {
    for (const f of ["Active", "Funding", "Operating", "Profitable", "Completed", "My Investments"]) {
      expect(listClient).toContain(`label: "${f}"`)
    }
  })

  it("IX12: cards surface funding %, members, ROI, health, next distribution and Invest CTA", () => {
    expect(listClient).toContain("fundingPercent")
    expect(listClient).toContain("Investors")
    expect(listClient).toContain("ROI")
    expect(listClient).toContain("Health")
    expect(listClient).toContain("Next distribution")
    expect(listClient).toContain("Invest")
    expect(listClient).toContain("Quick View")
  })

  it("IX13: the overview tab is now a full investment dashboard", () => {
    expect(overviewTab).toContain("investment-dashboard")
    expect(overviewTab).toContain("Your Investment")
    expect(overviewTab).toContain("Funding Progress")
    expect(overviewTab).toContain("Ownership Breakdown")
    expect(overviewTab).toContain("Revenue vs Expenses")
    expect(overviewTab).toContain("Cash Flow")
    expect(overviewTab).toContain("ROI Trend")
    expect(overviewTab).toContain("Pending Approvals")
    expect(overviewTab).toContain("Activity & Updates")
  })

  it("IX14: members can download their own statement (PDF)", () => {
    expect(exists("src/app/api/circles/[circleId]/projects/[projectId]/member-statement/route.ts")).toBe(true)
    expect(memberStatementRoute).toContain("generateProjectMemberStatementPdf")
    expect(memberStatementRoute).toContain("requireProjectInCircle(projectId, circleId)")
    expect(pdfGenerator).toContain("PDFDocument")
  })

  it("IX15: publish-update notifies circle members with a project notification type", () => {
    expect(updatesRoute).toContain("publishProjectUpdate")
    expect(investSvc).toContain("notifyCircleMembers")
    expect(investSvc).toContain("PROJECT_UPDATE_PUBLISHED")
    expect(schema).toContain("PROJECT_UPDATE_PUBLISHED")
  })

  it("IX16: a confirmed investment notifies the investor", () => {
    expect(capitalSvc).toContain("createNotification")
    expect(capitalSvc).toContain("CONTRIBUTION_MADE")
    expect(capitalSvc).toContain("Investment confirmed")
  })

  it("IX17: loading skeletons, errors/retry and empty states exist", () => {
    expect(overviewTab).toContain("Retry")
    expect(overviewTab).toContain("OverviewSkeleton")
    expect(overviewTab).toContain("Skeleton")
    expect(listClient).toContain("No projects yet")
  })

  it("IX18: member experience is not read-only (self-service commit + proof)", () => {
    expect(investDialog).toContain("Commit")
    expect(investDialog).toContain("pending approval")
    expect(investDialog).toContain("Your commitment was recorded")
  })
})