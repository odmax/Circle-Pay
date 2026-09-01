import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
  computeTravelCategoryBudget,
  computeTravelReconciliation,
  computeTravelBudget,
  computeMyTravelPosition,
} from "@/lib/services/travel-metrics"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const expenseSvc = readFile("src/lib/services/expense.service.ts")
const balanceSvc = readFile("src/lib/services/balance.service.ts")
const financeSvc = readFile("src/lib/services/travel-finance.service.ts")
const smartSvc = readFile("src/lib/services/travel.service.ts")
const ctx = readFile("src/lib/api/travel-ctx.ts")
const expenseRoute = readFile("src/app/api/circles/[circleId]/travel/expenses/route.ts")
const settleRoute = readFile("src/app/api/circles/[circleId]/travel/settlements/route.ts")
const budgetRoute = readFile("src/app/api/circles/[circleId]/travel/budget/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/travel-budget/page.tsx")
const ui = readFile("src/components/travel/travel-budget.tsx")
const dash = readFile("src/components/travel/travel-dashboard.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Travel Budget & Reconciliation — Pure Math", () => {
  it("TF1: per-category budget remaining is budgeted minus spent (over/under)", () => {
    const rows = computeTravelCategoryBudget([
      { category: "FLIGHTS", budgeted: 10000, spent: 8000 },
      { category: "FOOD", budgeted: 5000, spent: 6000 },
    ])
    expect(rows[0].remaining).toBe(2000)
    expect(rows[1].remaining).toBe(-1000)
  })

  it("TF2: reconciliation formula = contributions + paid − share − settled(net)", () => {
    const rows = computeTravelReconciliation({
      members: [{ userId: "a", name: "A" }, { userId: "b", name: "B" }],
      contributions: { a: 5000, b: 5000 },
      paidExpenses: { a: 2000, b: 0 },
      share: { a: 4000, b: 4000 },
      settledGiven: { a: 1000 },
      settledReceived: { b: 1000 },
    })
    const a = rows.find((r) => r.userId === "a")!
    const b = rows.find((r) => r.userId === "b")!
    expect(a.finalBalance).toBe(5000 + 2000 - 4000 - 1000) // 2000
    expect(b.finalBalance).toBe(5000 + 0 - 4000 + 1000) // 2000
  })

  it("TF3: budget + my-position helpers remain consistent", () => {
    const b = computeTravelBudget({ collected: 8000, spent: 3000, totalBudget: 10000, contributionTarget: 8000, memberCount: 4, membersPaid: 3 })
    expect(b.budgetUsedPct).toBe(30)
    expect(b.collectionPct).toBe(100)
    expect(b.remaining).toBe(5000)
  })
})

describe("Travel Finance — Reuse Existing Engines, No Duplicate Math", () => {
  it("TF4: travel expenses reuse the shared circle expense + settlement engines", () => {
    expect(financeSvc).toContain('import("@/lib/services/expense.service")')
    expect(financeSvc).toContain("createExpense(")
    expect(financeSvc).toContain('import("@/lib/services/balance.service")')
    expect(financeSvc).toContain("createSettlement(")
  })

  it("TF5: settlement duplicate + outstanding-limit guard exists (double settlement prevented)", () => {
    expect(balanceSvc).toContain("Settlement amount cannot exceed outstanding balance")
    expect(balanceSvc).toContain("A pending settlement between these members already exists")
    expect(balanceSvc).toContain('where: { id: settlementId, status: "PENDING" }')
  })

  it("TF6: member expenses reconcile via the shared splits (no duplicated engine)", () => {
    expect(financeSvc).toContain("computeTravelReconciliation(")
    expect(financeSvc).toContain("computeTravelCategoryBudget(")
    expect(financeSvc).toContain("e.splits")
  })
})

describe("Travel Finance — Security & Isolation", () => {
  it("TF7: cross-circle/travel-only access on every travel finance route", () => {
    for (const f of [expenseRoute, settleRoute, budgetRoute]) {
      expect(f).toContain("getTravelCtx(circleId)")
    }
    expect(page).toContain('if (circle.type !== "TRAVEL") notFound()')
  })

  it("TF8: members can only record expenses they paid themselves (unless manager)", () => {
    expect(expenseRoute).toContain("You can only record expenses you paid yourself")
    expect(expenseRoute).toContain("CIRCLE_PERMISSIONS.EXPENSE_CREATE")
    expect(expenseRoute).toContain("!ctx.isManager && paidById !== ctx.userId")
  })

  it("TF9: settlement route reuses the debtor/creditor-only guard", () => {
    expect(settleRoute).toContain("createTravelSettlement(")
    expect(balanceSvc).toContain("You must be the debtor or creditor to create a settlement")
  })

  it("TF10: receipts stay private via the shared proof storage", () => {
    expect(expenseRoute).toContain("validateProofFile")
    expect(expenseRoute).toContain("uploadProofImage")
    expect(settleRoute).toContain("uploadProofImage")
  })
})

describe("Travel Finance — Idempotency & Linkage", () => {
  it("TF11: travel expenses can link to itinerary/bookings via travelItemId", () => {
    expect(schema).toContain("travelItemId String?")
    expect(financeSvc).toContain("prisma.expense.update")
    expect(financeSvc).toContain("travelItemId: data.travelItemId")
  })

  it("TF12: category budget is stored on the trip, not a new finance system", () => {
    expect(schema).toContain("budgetByCategory    Json?")
    expect(budgetRoute).toContain("budgetByCategory")
  })

  it("TF13: settlement proof attaches via the existing Settlement model", () => {
    expect(schema).toContain("proofUrl       String?")
    expect(balanceSvc).toContain("proofUrl: data.proofUrl || null,")
  })
})

describe("Travel Finance — Dashboard Integration & Member/Admin UX", () => {
  it("TF14: travel dashboard exposes finances widgets", () => {
    expect(smartSvc).toContain("getTravelFinances(")
    expect(smartSvc).toContain("myOutstanding")
    expect(dash).toContain("Travel finances")
    expect(dash).toContain("Total spent")
    expect(dash).toContain("Budget remaining")
    expect(dash).toContain("My outstanding")
  })

  it("TF15: budget page surface covers budget/split/settlement/reconciliation", () => {
    expect(ui).toContain("Budget & Settlements")
    expect(ui).toContain("Set budgets")
    expect(ui).toContain("Add expense")
    expect(ui).toContain("Record settlement")
    expect(ui).toContain("Final trip reconciliation")
    expect(ui).toContain("Over budget")
  })

  it("TF16: Budget tab is TRAVEL-only", () => {
    expect(circleTypes.split("tabs.budget").length - 1).toBe(1)
    expect(circleTypes).toMatch(/TRAVEL: \{[^]+?tabs: \[tabs\.trip, tabs\.itinerary, tabs\.budget,/)
  })

  it("TF17: mobile-safe layout on the budget page", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("overflow-y-auto")
    expect(ui).toContain("min-w-[640px]") // reconciliation table scrolls on small screens
  })

  it("TF18: empty states exist for expenses, budgets and balances", () => {
    expect(ui).toContain("No travel expenses yet")
    expect(ui).toContain("No budget or expenses yet")
    expect(ui).toContain("No outstanding balances")
  })
})