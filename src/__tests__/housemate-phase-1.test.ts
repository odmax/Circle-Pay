import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { computeRentStatus, computeHouseholdAlerts, computeHouseholdBudget } from "@/lib/services/household-metrics"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const metrics = readFile("src/lib/services/household-metrics.ts")
const svc = readFile("src/lib/services/household.service.ts")
const ctx = readFile("src/lib/api/household-ctx.ts")
const route = readFile("src/app/api/circles/[circleId]/household/route.ts")
const remindRoute = readFile("src/app/api/circles/[circleId]/household/remind/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/household/page.tsx")
const ui = readFile("src/components/household/household-dashboard.tsx")
const permissions = readFile("src/lib/permissions/circlePermissions.ts")
const roles = readFile("src/lib/permissions/circle-role-permissions.ts")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Housemate — Pure Metrics", () => {
  it("HH1: rent status computes paid/overdue/due-soon", () => {
    const today = new Date("2026-06-10")
    expect(computeRentStatus({ monthlyRent: 8000, paidThisMonth: 8000, dueDay: 1, today }).status).toBe("paid")
    expect(computeRentStatus({ monthlyRent: 8000, paidThisMonth: 0, dueDay: 1, today }).status).toBe("overdue")
    expect(computeRentStatus({ monthlyRent: 8000, paidThisMonth: 0, dueDay: 12, today }).status).toBe("due_soon")
    expect(computeRentStatus({ monthlyRent: 8000, paidThisMonth: 0, dueDay: 20, today }).status).toBe("upcoming")
    expect(computeRentStatus({ monthlyRent: 0, paidThisMonth: 0, dueDay: 1, today }).status).toBe("none")
  })

  it("HH2: household alerts fire for overdue rent, utility due, overspend, settlements, pending proof", () => {
    const alerts = computeHouseholdAlerts({
      rentStatus: { paid: false, status: "overdue", days: 2, label: "Overdue by 2 day(s)" },
      recentBills: [{ id: "b1", name: "Electricity", dueDate: new Date(Date.now() + 2 * 86400000).toISOString() }],
      utilitiesThisMonth: 9000,
      monthlyRent: 8000,
      membersOwing: 2,
      pendingProof: true,
    })
    expect(alerts.some((a) => a.title.includes("overdue"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Utility due"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("overspending"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Settlement outstanding"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("unverified"))).toBe(true)
  })

  it("HH3: reuses the shared generic budget/position math (no duplicated engine)", () => {
    const b = computeHouseholdBudget({ collected: 8000, spent: 3000, totalBudget: 8000, contributionTarget: 8000, memberCount: 4, membersPaid: 3 })
    expect(b.collectionPct).toBe(100)
    expect(b.budgetUsedPct).toBe(38)
  })
})

describe("Housemate — Schema & Setup", () => {
  it("HH4: HouseholdConfig model with the setup fields and one-per-circle constraint", () => {
    expect(schema).toMatch(/^model HouseholdConfig \{/m)
    expect(schema).toContain("circleId         String   @unique")
    for (const f of ["name", "address", "leaseStart", "leaseEnd", "monthlyRent", "rentDueDay", "deposit", "currency", "rooms", "utilityCategories", "rules", "emergencyContact", "landlordContact"]) {
      expect(schema).toMatch(new RegExp(`^  ${f}\\s+`, "m"))
    }
  })

  it("HH5: setup persists bills and utility categories and is audited", () => {
    expect(schema).toContain("bills            Json?")
    expect(schema).toContain("utilityCategories Json?")
    expect(svc).toContain('action: "HOUSEHOLD_UPDATED"')
  })
})

describe("Housemate — Permissions (no hardcoded roles)", () => {
  it("HH6: HOUSEHOLD perms exist and are role-gated", () => {
    expect(permissions).toContain('HOUSEHOLD_VIEW: "HOUSEHOLD_VIEW"')
    expect(permissions).toContain('HOUSEHOLD_MANAGE: "HOUSEHOLD_MANAGE"')
    const admin = roles.slice(roles.indexOf("const ADMIN_PERMISSIONS"), roles.indexOf("const TREASURER_PERMISSIONS"))
    const treasurer = roles.slice(roles.indexOf("const TREASURER_PERMISSIONS"), roles.indexOf("const MEMBER_PERMISSIONS"))
    const member = roles.slice(roles.indexOf("const MEMBER_PERMISSIONS"), roles.indexOf("const VIEWER_PERMISSIONS"))
    expect(admin).toContain("P.HOUSEHOLD_MANAGE")
    expect(treasurer).toContain("P.HOUSEHOLD_MANAGE")
    expect(member).toContain("P.HOUSEHOLD_VIEW")
    expect(member).not.toContain("P.HOUSEHOLD_MANAGE")
  })
})

describe("Housemate — Reuse & Security", () => {
  it("HH7: dashboard reuses contributions/expenses/schedules/settlements/feed — no finance engine duplicated", () => {
    expect(svc).toContain("prisma.contribution.findMany")
    expect(svc).toContain("prisma.expense.findMany")
    expect(svc).toContain("prisma.expenseSplit.findMany")
    expect(svc).toContain("prisma.contributionSchedule.findMany")
    expect(svc).toContain("getCircleBalances(")
    expect(svc).toContain("prisma.feedPost.findMany")
    expect(svc).not.toContain("prisma.expense.create(")
  })

  it("HH8: reminders reuse the existing notification system (CONTRIBUTION_REMINDER)", () => {
    expect(svc).toContain("createBulkNotifications")
    expect(svc).toContain('type: "CONTRIBUTION_REMINDER"')
  })

  it("HH9: cross-circle isolation and HOUSEMATE-only access on every route/page", () => {
    expect(ctx).toContain('circle.type !== "HOUSEMATE"')
    expect(route).toContain("getHouseholdCtx(circleId)")
    expect(route).toContain('ctx.isManager')
    expect(remindRoute).toContain('ctx.isManager')
    expect(page).toContain('if (circle.type !== "HOUSEMATE") notFound()')
  })
})

describe("Housemate — Dashboard & Experience", () => {
  it("HH10: widgets cover rent, bills, my position, shared expenses, upcoming, members, settlements, alerts", () => {
    for (const w of ["Monthly cost", "Rent paid", "Utilities this month", "Shared expenses", "Household balance", "Members paid", "Next rent due", "Settlements outstanding", "My household position"]) {
      expect(ui).toContain(w)
    }
  })

  it("HH11: member self-service links to shared contribution/expense/settlement flows", () => {
    expect(ui).toContain("Pay rent / export proof")
    expect(ui).toContain("${base}/contributions")
    expect(ui).toContain("${base}/expenses")
    expect(ui).toContain("${base}/settlements")
  })

  it("HH12: admin controls are gated on canManage (configure/remind)", () => {
    expect(ui).toContain("canManage &&")
    expect(ui).toContain("Configure")
    expect(ui).toContain("Remind")
    expect(ui).toContain("Set up household")
  })

  it("HH13: empty states for unconfigured household", () => {
    expect(ui).toContain("Household not configured yet")
    expect(ui).toContain("Only household managers can configure this home")
  })

  it("HH14: Home tab is HOUSEMATE-only", () => {
    expect(circleTypes.split("tabs.house").length - 1).toBe(1)
    expect(circleTypes).toMatch(/HOUSEMATE: \{[^]+?tabs: \[tabs\.house,/)
  })

  it("HH15: mobile-safe layout", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("lg:grid-cols-4")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("truncate")
  })
})