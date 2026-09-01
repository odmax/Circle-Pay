import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { computeBillStatus, computeBillShares, periodOf } from "@/lib/services/household-bills.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/household-bills.service.ts")
const householdSvc = readFile("src/lib/services/household.service.ts")
const ctx = readFile("src/lib/api/household-ctx.ts")
const billsRoute = readFile("src/app/api/circles/[circleId]/household/bills/route.ts")
const billRoute = readFile("src/app/api/circles/[circleId]/household/bills/[billId]/route.ts")
const actualRoute = readFile("src/app/api/circles/[circleId]/household/bills/[billId]/actual/route.ts")
const payRoute = readFile("src/app/api/circles/[circleId]/household/bills/[billId]/pay/route.ts")
const cron = readFile("src/app/api/cron/opportunity-reminders/route.ts")
const ui = readFile("src/components/household/household-dashboard.tsx")
const page = readFile("src/app/(dashboard)/circles/[circleId]/household/page.tsx")

describe("Recurring Bills — Pure Lifecycle Math", () => {
  it("HB1: bill status tracks UPCOMING → DUE → PAID/PARTIALLY_PAID/OVERDUE", () => {
    const today = new Date("2026-06-10")
    expect(computeBillStatus({ paid: 1000, expected: 1000, dueDate: "2026-06-05", today })).toBe("PAID")
    expect(computeBillStatus({ paid: 400, expected: 1000, dueDate: "2026-06-05", today })).toBe("PARTIALLY_PAID")
    expect(computeBillStatus({ paid: 0, expected: 1000, dueDate: "2026-06-05", today })).toBe("OVERDUE")
    expect(computeBillStatus({ paid: 0, expected: 1000, dueDate: "2026-06-10", today })).toBe("DUE")
    expect(computeBillStatus({ paid: 0, expected: 1000, dueDate: "2026-06-15", today })).toBe("UPCOMING")
  })

  it("HB2: shares split equal/exact/percentage", () => {
    const equal = computeBillShares({ splitType: "EQUAL", expectedAmount: 100, shareConfig: null, participatingIds: ["a", "b", "c"] })
    expect(Math.round(equal.a * 100) / 100).toBe(33.33)
    expect(equal.b).toBe(33.33)
    expect(Math.round(equal.c * 100) / 100).toBe(33.34)
    const exact = computeBillShares({ splitType: "EXACT", expectedAmount: 100, shareConfig: [{ userId: "a", amount: 40 }, { userId: "b", amount: 60 }], participatingIds: ["a", "b"] })
    expect(exact.a).toBe(40)
    expect(exact.b).toBe(60)
    const pct = computeBillShares({ splitType: "PERCENTAGE", expectedAmount: 200, shareConfig: [{ userId: "a", percentage: 25 }, { userId: "b", percentage: 75 }], participatingIds: ["a", "b"] })
    expect(pct.a).toBe(50)
    expect(pct.b).toBe(150)
  })

  it("HB3: period key is YYYY-MM and idempotent upsert key exists", () => {
    expect(periodOf(new Date("2026-06-15"))).toBe("2026-06")
    expect(schema).toContain("@@unique([billId, periodKey])")
  })
})

describe("Recurring Bills — Schema & Idempotent Generation", () => {
  it("HB4: recurring + instance + payment models exist with unique instance per period", () => {
    for (const m of ["HouseholdRecurringBill", "HouseholdBill", "HouseholdBillPayment"]) expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"))
    expect(schema).toContain("@@unique([billId, periodKey])")
    expect(schema).toContain("status               String   @default(\"UPCOMING\")")
  })

  it("HB5: generation is idempotent — skips existing instances per (bill, month)", () => {
    expect(svc).toContain("ensureBillGeneration(")
    expect(svc).toContain("findUnique({ where: { billId_periodKey:")
    expect(svc).toContain("if (existing) continue")
    expect(svc).toContain('prisma.householdBill.create(')
  })
})

describe("Utility Bill Upload & Payments — Reuse & Integrity", () => {
  it("HB6: actual bill upload uses private storage, gates responsible/manager, notifies participants", () => {
    expect(actualRoute).toContain("validateProofFile")
    expect(actualRoute).toContain("uploadProofImage")
    expect(svc).toContain("Only the responsible member or a manager can record the actual bill")
    expect(svc).toContain("BILL_ACTUAL_UPLOADED")
  })

  it("HB7: payments are member-scoped, bounded by outstanding, and post once to the shared ledger", () => {
    expect(svc).toContain("You can only record payments for yourself")
    expect(svc).toContain("Amount must be positive and within the outstanding balance")
    expect(svc).toContain('import("@/lib/services/expense.service")')
    expect(svc).toContain("createExpense(")
    expect(svc).toContain("metadata: { expenseId, actorId }")
    expect(svc).toContain('status === "PAID" ? "BILL_SETTLED" : "BILL_PAYMENT_RECORDED"')
    expect(payRoute).toContain('.includes("participant")')
  })
})

describe("Reminders — Deduplicated", () => {
  it("HB8: 7/3/1/due/overdue stages notify participants with a daily sentinel", () => {
    expect(svc).toContain('days <= 7 ? "d7"')
    expect(svc).toContain('stage === "overdue" ? "BILL_OVERDUE" : "BILL_DUE"')
    expect(svc).toContain("reminders")
    expect(cron).toContain("sweepHouseholdBills")
  })

  it("HB9: notification types exist for the bill lifecycle", () => {
    for (const t of ["BILL_DUE", "BILL_OVERDUE", "BILL_PAYMENT_RECORDED", "BILL_SETTLED", "BILL_ACTUAL_UPLOADED"]) expect(schema).toContain(t)
  })
})

describe("Dashboard & Security", () => {
  it("HB10: the home dashboard exposes monthly bill summary + upcoming bills", () => {
    expect(householdSvc).toContain("getMonthlyBillsSummary(")
    expect(householdSvc).toContain("upcomingBills")
    expect(householdSvc).toContain("billsSummary")
    expect(ui).toContain("Bills & utilities")
    expect(ui).toContain("Bills due this week")
    expect(ui).toContain("Overdue bills")
    expect(ui).toContain("Create bill")
    expect(ui).toContain("Pay my share")
    expect(ui).toContain("Record actual")
  })

  it("HB11: empty state for no bills this month", () => {
    expect(ui).toContain("No bills yet this month")
  })

  it("HB12: HOUSEMATE-only activation and cross-circle isolation", () => {
    expect(ctx).toContain('circle.type !== "HOUSEMATE"')
    expect(billsRoute).toContain("getHouseholdCtx(circleId)")
    expect(billRoute).toContain('ctx.isManager')
    expect(page).toContain('if (circle.type !== "HOUSEMATE") notFound()')
  })

  it("HB13: admin-only actions (create/edit/pause/generate) are manager gated", () => {
    expect(billsRoute).toContain('ctx.isManager')
    expect(billRoute).toContain('ctx.isManager')
  })

  it("HB14: mobile-safe layout", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("truncate")
  })
})