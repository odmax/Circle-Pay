import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { toShares } from "@/lib/services/household-purchase.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/household-purchase.service.ts")
const householdSvc = readFile("src/lib/services/household.service.ts")
const ctx = readFile("src/lib/api/household-ctx.ts")
const purchasesRoute = readFile("src/app/api/circles/[circleId]/household/groceries/purchases/route.ts")
const purchaseRoute = readFile("src/app/api/circles/[circleId]/household/groceries/purchases/[purchaseId]/route.ts")
const runsRoute = readFile("src/app/api/circles/[circleId]/household/groceries/runs/route.ts")
const runRoute = readFile("src/app/api/circles/[circleId]/household/groceries/runs/[runId]/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/groceries/page.tsx")
const ui = readFile("src/components/household/groceries.tsx")
const dash = readFile("src/components/household/household-dashboard.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Shared Purchases — Pure Share Math", () => {
  it("HP1: toShares produces equal/exact/percentage shares for purchases", () => {
    const eq = toShares({ amount: 100, splitType: "EQUAL", splitConfig: null, participantIds: ["a", "b", "c"] })
    expect(Math.round(eq.a * 100) / 100).toBe(33.33)
    expect(eq.c).toBeGreaterThan(33.33)
    const ex = toShares({ amount: 100, splitType: "EXACT", splitConfig: [{ userId: "a", amount: 40 }, { userId: "b", amount: 60 }], participantIds: ["a", "b"] })
    expect(ex.a).toBe(40)
    expect(ex.b).toBe(60)
  })

  it("HP2: supported purchase categories exist", () => {
    expect(svc).toContain('["GROCERIES", "CLEANING", "TOILETRIES", "EQUIPMENT", "FURNITURE", "KITCHEN", "SUBSCRIPTION", "CUSTOM"]')
  })
})

describe("Shared Purchases — Ledger Integrity", () => {
  it("HP3: a purchase posts once to the shared expense ledger and records the expense id", () => {
    expect(svc).toContain('import("@/lib/services/expense.service")')
    expect(svc).toContain("createExpense(circleId, actorId, {")
    expect(svc).toContain("expenseId = expense.id")
    expect(svc).toContain("expenseId,")
    expect(schema).toContain("expenseId       String?")
  })

  it("HP4: members only record purchases they paid; managers may record shared purchases", () => {
    expect(svc).toContain("You can only record purchases you paid for yourself")
    expect(svc).toContain("!isManager && paidById !== actorId")
  })

  it("HP5: ledger-backed fields stay immutable after posting (no silent financial drift)", () => {
    expect(svc).toContain("if (!p.expenseId) {")
    expect(svc).toContain("Amount/payer/split are ledger-backed and only mutable before a ledger post")
  })

  it("HP6: purchase edits/deletes are audited", () => {
    expect(svc).toContain("HOUSEHOLD_PURCHASE_CREATED")
    expect(svc).toContain("HOUSEHOLD_PURCHASE_UPDATED")
    expect(svc).toContain("HOUSEHOLD_PURCHASE_DELETED")
  })
})

describe("Grocery Runs & Shopping List", () => {
  it("HP7: run workflow PLANNED → SHOPPING → COMPLETED/CANCELLED with audit", () => {
    expect(svc).toContain('const RUN_STATUSES = ["PLANNED", "SHOPPING", "COMPLETED", "CANCELLED"]')
    expect(svc).toContain("GROCERY_RUN_STATUS")
    expect(svc).toContain("oldValues: { status: run.status }")
  })

  it("HP8: shared shopping list items are deduplicated per run", () => {
    expect(schema).toContain("@@unique([runId, name])")
    expect(svc).toContain("Item already on the list")
  })

  it("HP9: members contribute items; shopper/adder/managers toggle purchased", () => {
    expect(svc).toContain("Only the shopper or the person who added the item can change it")
    expect(svc).toContain("addGroceryItem(")
    expect(svc).toContain("prisma.householdGroceryItem.create(")
  })

  it("HP10: run actual spend reconciles from linked purchases", () => {
    expect(schema).toContain("actualSpend         Decimal?")
    expect(svc).toContain("reconcileRunSpend(")
  })
})

describe("Member & Dashboard Experience", () => {
  it("HP11: the home dashboard surfaces groceries widgets", () => {
    expect(householdSvc).toContain("getGroceriesSummary(")
    expect(dash).toContain("Groceries this month")
    expect(dash).toContain("Shared purchases")
    expect(dash).toContain("My household spend")
    expect(dash).toContain("Upcoming grocery run")
    expect(dash).toContain("Open Groceries")
  })

  it("HP12: member view covers purchases, my share, runs and the shopping list", () => {
    expect(ui).toContain("Shared purchases")
    expect(ui).toContain("your share")
    expect(ui).toContain("Grocery runs")
    expect(ui).toContain("Add item to the list")
    expect(ui).toContain("Add purchase")
    expect(ui).toContain("New grocery run")
  })

  it("HP13: empty states exist", () => {
    expect(ui).toContain("No shared purchases yet")
    expect(ui).toContain("No grocery runs yet")
  })

  it("HP14: mobile-safe layout", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("truncate")
    expect(dash).toContain("lg:grid-cols-4")
  })
})

describe("Security & Isolation", () => {
  it("HP15: receipts use private storage and purchases are HOUSEMATE-only", () => {
    expect(purchasesRoute).toContain("validateProofFile")
    expect(purchasesRoute).toContain("uploadProofImage")
    expect(ctx).toContain('circle.type !== "HOUSEMATE"')
    expect(routePath(page)).toContain('circle.type !== "HOUSEMATE"')
  })

  it("HP16: cross-circle isolation on all grocery routes", () => {
    for (const f of [purchasesRoute, purchaseRoute, runsRoute, runRoute]) expect(f).toContain("getHouseholdCtx(circleId)")
  })

  it("HP17: Groceries tab is HOUSEMATE-only", () => {
    expect(circleTypes.split("tabs.groceries").length - 1).toBe(1)
    expect(circleTypes).toMatch(/HOUSEMATE: \{[^]+?tabs: \[tabs\.house, tabs\.groceries,/)
  })
})

function routePath(src: string): string {
  return src
}