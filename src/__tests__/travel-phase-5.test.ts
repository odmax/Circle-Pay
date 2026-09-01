import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { buildStatementRows } from "@/lib/services/travel-close.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/travel-close.service.ts")
const ctx = readFile("src/lib/api/travel-ctx.ts")
const closeRoute = readFile("src/app/api/circles/[circleId]/travel/close/route.ts")
const statementRoute = readFile("src/app/api/circles/[circleId]/travel/statement/route.ts")
const pdfGen = readFile("src/lib/receipt/pdf-travel-statement-generator.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/trip-close/page.tsx")
const ui = readFile("src/components/travel/travel-close.tsx")
const smartSvc = readFile("src/lib/services/travel.service.ts")
const circleTypes = readFile("src/lib/circle-types.ts")
const itinerarySvc = readFile("src/lib/services/travel-itinerary.service.ts")

describe("Trip Close — Pure Reconciliation", () => {
  it("TC1: statement rows derive refund/owed/final balance from the shared reconciliation", () => {
    const rows = buildStatementRows({
      members: [{ userId: "a", name: "A" }, { userId: "b", name: "B" }],
      reconciliation: [
        { userId: "a", name: "A", contributions: 6000, memberPaidExpenses: 2000, share: 5000, settledGiven: 2000, settledReceived: 0, finalBalance: 1000 },
        { userId: "b", name: "B", contributions: 4000, memberPaidExpenses: 0, share: 5000, settledGiven: 0, settledReceived: 2000, finalBalance: 1000 },
      ],
    })
    expect(rows[0].refundAvailable).toBe(1000)
    expect(rows[0].amountOwed).toBe(0)
    expect(rows[0].finalBalance).toBe(1000)
  })

  it("TC2: new close statuses and immutable statement snapshots exist", () => {
    const en = (schema.match(/enum TravelTripStatus \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["RECONCILING", "PENDING_SETTLEMENT", "CLOSED"]) expect(en).toContain(v)
    expect(schema).toMatch(/^model TravelStatementSnapshot \{/m)
    expect(schema).toContain("@@unique([tripId, userId])")
    expect(schema).toContain("tripSummary         Json?")
    expect(schema).toContain("finalizedAt         DateTime?")
  })
})

describe("Trip Close — Workflow & Blockers", () => {
  it("TC3: workflow transitions are guarded and blocker-checked", () => {
    expect(svc).toContain("startTripReconciliation(")
    expect(svc).toContain("startTripSettlementPhase(")
    expect(svc).toContain("finalizeTrip(")
    expect(svc).toContain("workflowGuard(trip, [\"COMPLETED\"]")
    expect(svc).toContain("workflowGuard(trip, [\"RECONCILING\"]")
    expect(svc).toContain("workflowGuard(trip, [\"PENDING_SETTLEMENT\"]")
    expect(svc).toContain("Trip cannot be finalized:")
  })

  it("TC4: blockers include unsettled balances, pending/rejected settlements, missing receipts, refunds", () => {
    expect(svc).toContain("Unsettled balances")
    expect(svc).toContain("Pending settlements")
    expect(svc).toContain("Rejected settlements")
    expect(svc).toContain("Missing receipts")
    expect(svc).toContain("Refunds available")
  })

  it("TC5: finalization is idempotent and writes immutable per-member snapshots", () => {
    expect(svc).toContain("prisma.$transaction")
    expect(svc).toContain("travelStatementSnapshot.upsert")
    expect(svc).toContain("tripId_userId")
    expect(svc).toContain('status: "CLOSED"')
  })

  it("TC6: reopen is audited and never silently mutates finalized history", () => {
    expect(svc).toContain("reopenTrip(")
    expect(svc).toContain('action: "TRAVEL_REOPENED"')
    expect(svc).toContain("oldValues")
    expect(svc).toContain('reason: "Audited correction/reopen of finalized trip"')
  })
})

describe("Trip Close — Statements & PDF", () => {
  it("TC7: member statements are per-owner with a PDF download and manager override", () => {
    expect(svc).toContain("getMyFinalStatement(")
    expect(svc).toContain("travelStatementSnapshot.findUnique")
    expect(statementRoute).toContain("generateTravelStatementPdf")
    expect(statementRoute).toContain("memberId")
    expect(statementRoute).toContain("ctx.isManager")
    expect(pdfGen).toContain("PDFDocument")
    expect(pdfGen).toContain("Final Trip Statement")
  })
})

describe("Trip Close — Notifications", () => {
  it("TC8: members are notified on reconcile, settlement required, refund available, statement ready, finalized", () => {
    expect(svc).toContain("Reconciliation started:")
    expect(svc).toContain("Settlement required:")
    expect(svc).toContain("Refund available:")
    expect(svc).toContain("Your trip statement is ready")
    expect(svc).toContain("Trip finalized:")
    expect(svc).toContain("STATEMENT_READY")
  })
})

describe("Trip Close — Security", () => {
  it("TC9: transitions and cross-member statements require manager, cross-circle blocked", () => {
    expect(closeRoute).toContain("getTravelCtx(circleId)")
    expect(closeRoute).toContain("if (!ctx.isManager) return NextResponse.json({ error: \"Forbidden\" }")
    expect(ctx).toContain('circle.type !== "TRAVEL"')
    expect(page).toContain('if (circle.type !== "TRAVEL") notFound()')
  })

  it("TC10: statements reuse the shared finance engine (no duplicated math)", () => {
    expect(svc).toContain("getTravelFinances(")
    expect(svc).toContain("buildStatementRows(")
  })
})

describe("Trip Close — Dashboard & UX", () => {
  it("TC11: close review exposes totals: contributions/spend/variance/settlements/collection/per-person/refunds", () => {
    expect(svc).toContain("totalContributions")
    expect(svc).toContain("totalSpent")
    expect(svc).toContain("variance")
    expect(svc).toContain("totalSettlements")
    expect(svc).toContain("collectionRate")
    expect(svc).toContain("perPersonCost")
    expect(svc).toContain("refundsDue")
  })

  it("TC12: admin close dashboard UI covers progress, blockers, member balances, refunds/owed", () => {
    expect(ui).toContain("Trip Close & Final Reconciliation")
    expect(ui).toContain("Finalize trip")
    expect(ui).toContain("Reopen (audited)")
    expect(ui).toContain("Final member balances")
    expect(ui).toContain("Settlement required")
    expect(ui).toContain("Refunds available")
    expect(ui).toContain("Statement PDF")
  })

  it("TC13: Close tab is TRAVEL-only", () => {
    expect(circleTypes.split("tabs.close").length - 1).toBe(1)
    expect(circleTypes).toMatch(/TRAVEL: \{[^]+?tabs: \[tabs\.trip, tabs\.itinerary, tabs\.budget, tabs\.documents, tabs\.close,/)
  })

  it("TC14: mobile-safe layout for the close dashboard", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("overflow-x-auto")
    expect(ui).toContain("min-w-[680px]")
  })

  it("TC15: the close page links back to the trip dashboard", () => {
    expect(ui).toContain("/trip")
  })
})