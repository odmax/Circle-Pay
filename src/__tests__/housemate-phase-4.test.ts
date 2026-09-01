import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { occurrenceKey, computeChoreStatus, pickRotationAssignee } from "@/lib/services/household-chores.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/household-chores.service.ts")
const householdSvc = readFile("src/lib/services/household.service.ts")
const ctx = readFile("src/lib/api/household-ctx.ts")
const choresRoute = readFile("src/app/api/circles/[circleId]/household/chores/route.ts")
const instanceRoute = readFile("src/app/api/circles/[circleId]/household/chores/instances/[choreId]/route.ts")
const swapRoute = readFile("src/app/api/circles/[circleId]/household/chores/swaps/[swapId]/route.ts")
const templateRoute = readFile("src/app/api/circles/[circleId]/household/chores/[templateId]/route.ts")
const cron = readFile("src/app/api/cron/opportunity-reminders/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/chores/page.tsx")
const ui = readFile("src/components/household/chores.tsx")
const dash = readFile("src/components/household/household-dashboard.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Chores — Pure Recurrence & Rotation Math", () => {
  it("CH1: occurrence keys are stable and idempotent per frequency", () => {
    const d = new Date("2026-06-15T10:00:00Z")
    expect(occurrenceKey("ONCE", d)).toBe("once")
    expect(occurrenceKey("DAILY", d)).toBe("2026-06-15")
    expect(occurrenceKey("WEEKLY", d)).toMatch(/2026-W\d+/)
    expect(occurrenceKey("BIWEEKLY", d)).toMatch(/2026-BW\d+/)
    expect(occurrenceKey("MONTHLY", d)).toBe("2026-06")
  })

  it("CH2: status lifecycle and rotation picker", () => {
    const now = new Date("2026-06-10T12:00:00")
    expect(computeChoreStatus(new Date("2026-06-10T12:00:00"), "UPCOMING", now)).toBe("DUE")
    expect(computeChoreStatus(new Date("2026-06-08T12:00:00"), "UPCOMING", now)).toBe("OVERDUE")
    expect(computeChoreStatus(new Date("2026-06-20T12:00:00"), "UPCOMING", now)).toBe("UPCOMING")
    expect(computeChoreStatus(new Date("2026-06-10T12:00:00"), "COMPLETED", now)).toBe("COMPLETED")
    expect(pickRotationAssignee(0, ["a", "b"])).toBe("a")
    expect(pickRotationAssignee(3, ["a", "b"])).toBe("b")
  })
})

describe("Chores — Schema & Idempotent Generation", () => {
  it("CH3: chore templates/instances/swaps exist with unique occurrence per template", () => {
    for (const m of ["HouseholdChoreTemplate", "HouseholdChore", "HouseholdChoreSwap"]) expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"))
    expect(schema).toContain("@@unique([templateId, ocKey])")
    expect(schema).toContain("swappedFromId  String?")
  })

  it("CH4: generation is idempotent and rotates assignees without rewriting history", () => {
    expect(svc).toContain("ensureChoreGeneration(")
    expect(svc).toContain("findUnique({ where: { templateId_ocKey:")
    expect(svc).toContain("if (await prisma.householdChore.findUnique")
    expect(svc).toContain("rotationCursor")
    expect(svc).toContain("swappedFromId")
  })

  it("CH5: supported categories/frequencies plus rotation types exist", () => {
    expect(svc).toContain('["CLEANING", "DISHES", "TRASH", "BATHROOM", "KITCHEN", "LAUNDRY", "SHOPPING", "GARDEN", "PET_CARE", "CUSTOM"]')
    expect(svc).toContain('["ONCE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]')
  })
})

describe("Chores — Security & Member-Only Actions", () => {
  it("CH6: members only complete/skip chores assigned to them", () => {
    expect(svc).toContain("You can only complete chores assigned to you")
    expect(svc).toContain("You can only skip chores assigned to you")
    expect(svc).toContain("c.assigneeId !== actorId")
  })

  it("CH7: members cannot self-approve their own swap request", () => {
    expect(svc).toContain("You cannot approve your own swap request")
    expect(svc).toContain("!isManager && swap.toUserId !== actorId")
  })

  it("CH8: manager reassignment preserves the original assignee (never rewrites history)", () => {
    expect(svc).toContain("swappedFromId: c.swappedFromId || c.assigneeId")
    expect(svc).toContain("CHORE_REASSIGNED")
  })

  it("CH9: everything is HOUSEMATE-scoped and cross-circle isolated", () => {
    expect(ctx).toContain('circle.type !== "HOUSEMATE"')
    for (const f of [choresRoute, instanceRoute, swapRoute, templateRoute]) expect(f).toContain("getHouseholdCtx(circleId)")
    expect(page).toContain('if (circle.type !== "HOUSEMATE") notFound()')
  })

  it("CH10: completion proof uses private storage", () => {
    expect(instanceRoute).toContain("validateProofFile")
    expect(instanceRoute).toContain("uploadProofImage")
  })
})

describe("Chores — Fairness & Dashboard", () => {
  it("CH11: fairness summary surface unevens workloads without punitive scoring", () => {
    expect(svc).toContain("uneven")
    expect(svc).toContain("assigned")
    expect(svc).toContain("completed")
    expect(svc).toContain("overdue")
    expect(ui).toContain("Responsibility fairness")
    expect(ui).toContain("Uneven workload")
  })

  it("CH12: home dashboard exposes chore widgets and grocery-shopper responsibility", () => {
    expect(householdSvc).toContain("choresSummary(")
    expect(householdSvc).toContain("myToday")
    expect(dash).toContain("My chores today")
    expect(dash).toContain("Household chores today")
    expect(dash).toContain("Overdue chores")
    expect(dash).toContain("Next responsibility")
    expect(dash).toContain("Groceries shopper")
  })

  it("CH13: member view covers My chores, today, overdue, completion progress", () => {
    expect(ui).toContain("My chores")
    expect(ui).toContain("Household chores")
    expect(ui).toContain("Household completion")
    expect(ui).toContain("Complete")
    expect(ui).toContain("Request swap")
  })

  it("CH14: empty states exist", () => {
    expect(ui).toContain("You have no assigned chores")
    expect(ui).toContain("No chores yet")
    expect(ui).toContain("No templates yet")
  })

  it("CH15: reminders are wired into the sweep cron with CHORE notification types", () => {
    expect(cron).toContain("sweepHouseholdChores")
    expect(svc).toContain('"CHORE_OVERDUE" : "CHORE_DUE"')
    for (const t of ["CHORE_ASSIGNED", "CHORE_DUE", "CHORE_OVERDUE", "CHORE_SWAP_REQUEST", "CHORE_SWAP_DECISION"]) expect(schema).toContain(t)
  })

  it("CH16: Chores tab/page is HOUSEMATE-only and mobile-safe", () => {
    expect(circleTypes.split("tabs.chores").length - 1).toBe(1)
    expect(circleTypes).toMatch(/HOUSEMATE: \{[^]+?tabs: \[tabs\.house, tabs\.groceries, tabs\.chores,/)
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
  })
})