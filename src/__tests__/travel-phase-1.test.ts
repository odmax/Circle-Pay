import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
  computeTripCountdown,
  computeTravelBudget,
  computeMyTravelPosition,
  computeTravelAlerts,
} from "@/lib/services/travel-metrics"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const permissions = readFile("src/lib/permissions/circlePermissions.ts")
const roles = readFile("src/lib/permissions/circle-role-permissions.ts")
const circleTypes = readFile("src/lib/circle-types.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/trip/page.tsx")
const route = readFile("src/app/api/circles/[circleId]/travel/route.ts")
const remindRoute = readFile("src/app/api/circles/[circleId]/travel/remind/route.ts")
const svc = readFile("src/lib/services/travel.service.ts")
const dash = readFile("src/components/travel/travel-dashboard.tsx")

describe("Travel Metrics — Pure Functions", () => {
  const future = new Date(Date.now() + 5 * 86400000).toISOString()
  const past = new Date(Date.now() - 2 * 86400000).toISOString()

  it("TR1: countdown handles planning (no date), upcoming, in-progress and completed", () => {
    expect(computeTripCountdown(null, null, "PLANNING").label).toContain("Planning")
    expect(computeTripCountdown(future, null, "CONFIRMED").daysToStart).toBe(5)
    expect(computeTripCountdown(future, null, "CONFIRMED").label).toContain("Starts in 5")
    const inProgress = computeTripCountdown(past, future, "ACTIVE")
    expect(inProgress.inProgress).toBe(true)
    expect(inProgress.label).toContain("days left")
    expect(computeTripCountdown(past, null, "COMPLETED").completed).toBe(true)
    expect(computeTripCountdown(past, null, "COMPLETED").label).toBe("Trip completed")
  })

  it("TR2: budget math — collection %, budget used %, remaining and outstanding members", () => {
    const b = computeTravelBudget({ collected: 6000, spent: 3000, totalBudget: 10000, contributionTarget: 8000, memberCount: 8, membersPaid: 6 })
    expect(b.collectionPct).toBe(75) // 6000/8000
    expect(b.budgetUsedPct).toBe(30) // 3000/10000
    expect(b.remaining).toBe(3000)
    expect(b.membersOutstanding).toBe(2)
  })

  it("TR3: my position — share target, outstanding and trip balance from paid vs expense share", () => {
    const m = computeMyTravelPosition({ myPaid: 1000, myPending: 0, contributionTarget: 8000, memberCount: 8, myExpenseShare: 300 })
    expect(m.myShareTarget).toBe(1000)
    expect(m.myOutstanding).toBe(0)
    expect(m.myTripBalance).toBe(700)
    expect(m.myStatus).toBe("Paid in full")
    const p = computeMyTravelPosition({ myPaid: 1000, myPending: 500, contributionTarget: 8000, memberCount: 8, myExpenseShare: 300 })
    expect(p.myStatus).toContain("pending review")
  })

  it("TR4: alerts — due soon, overdue, budget limit, event, poll, missing proof, trip start", () => {
    const in2 = new Date(Date.now() + 2 * 86400000).toISOString()
    const pastDay = new Date(Date.now() - 1 * 86400000).toISOString()
    const soonEvent = new Date(Date.now() + 1 * 86400000).toISOString()
    const alerts = computeTravelAlerts({
      countdown: computeTripCountdown(future, null, "CONFIRMED"),
      budget: computeTravelBudget({ collected: 9000, spent: 8500, totalBudget: 10000, contributionTarget: 9000, memberCount: 6, membersPaid: 4 }),
      contributionTarget: 9000,
      deadlines: [{ id: "d1", name: "Flights", amount: 1000, dueDate: in2 }, { id: "d2", name: "Hotel", amount: 2000, dueDate: pastDay }],
      events: [{ id: "e1", title: "Departure briefing", startAt: soonEvent }],
      openPollsNotVoted: 1,
      myPendingWithProof: false,
      myPendingWithoutProof: true,
    })
    expect(alerts.some((a) => a.title.includes("due soon"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("overdue"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Budget nearing limit"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Event approaching"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Poll awaiting"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Missing payment proof"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("Trip starts soon"))).toBe(true)
  })
})

describe("Travel — Schema", () => {
  it("TR5: TravelTrip model with the required fields and status enum", () => {
    expect(schema).toMatch(/^model TravelTrip \{/m)
    for (const f of ["name", "destination", "startDate", "endDate", "currency", "totalBudget", "contributionTarget", "status", "coverImage", "meetingPoint", "emergencyContact", "notes"]) {
      expect(schema).toMatch(new RegExp(`^  ${f}\\s+`, "m"))
    }
    expect(schema).toContain("circleId            String            @unique")
  })

  it("TR6: status enum matches the required workflow", () => {
    const en = (schema.match(/enum TravelTripStatus \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["PLANNING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"]) expect(en).toContain(v)
  })

  it("TR7: one trip per circle, cascade deleted with the circle", () => {
    expect(schema).toContain('circle    Circle @relation(fields: [circleId], references: [id], onDelete: Cascade)')
    expect(schema).toContain("travelTrip              TravelTrip?")
    expect(schema).toContain('createdBy User   @relation("TravelTripCreator"')
  })
})

describe("Travel — Permissions & Circle-Type Integration", () => {
  it("TR8: TRAVEL permissions exist and are role-gated", () => {
    expect(permissions).toContain('TRAVEL_TRIP_VIEW: "TRAVEL_TRIP_VIEW"')
    expect(permissions).toContain('TRAVEL_TRIP_MANAGE: "TRAVEL_TRIP_MANAGE"')
    const admin = roles.slice(roles.indexOf("const ADMIN_PERMISSIONS"), roles.indexOf("const TREASURER_PERMISSIONS"))
    const treasurer = roles.slice(roles.indexOf("const TREASURER_PERMISSIONS"), roles.indexOf("const MEMBER_PERMISSIONS"))
    const member = roles.slice(roles.indexOf("const MEMBER_PERMISSIONS"), roles.indexOf("const VIEWER_PERMISSIONS"))
    const viewer = roles.slice(roles.indexOf("const VIEWER_PERMISSIONS"), roles.indexOf("export const CIRCLE_ROLE_PERMISSIONS"))
    expect(admin).toContain("P.TRAVEL_TRIP_MANAGE")
    expect(treasurer).toContain("P.TRAVEL_TRIP_MANAGE")
    expect(member).toContain("P.TRAVEL_TRIP_VIEW")
    expect(member).not.toContain("P.TRAVEL_TRIP_MANAGE")
    expect(viewer).toContain("P.TRAVEL_TRIP_VIEW")
  })

  it("TR9: Trip activated ONLY for TRAVEL — other circle types are untouched", () => {
    // The trip tab is referenced exactly once: in the TRAVEL config's tabs array.
    expect(circleTypes.split("tabs.trip").length - 1).toBe(1)
    expect(circleTypes).toMatch(/TRAVEL: \{[^]+?tabs: \[tabs\.trip,/)
  })

  it("TR10: the trip page refuses non-TRAVEL circles (404)", () => {
    expect(page).toContain('if (circle.type !== "TRAVEL") notFound()')
  })
})

describe("Travel — Reuses Existing Finance Notifications", () => {
  it("TR11: no new finance engine — reuses contributions, expenses, schedules, events, polls, feed", () => {
    expect(svc).toContain("prisma.contribution.findMany")
    expect(svc).toContain("prisma.expense.findMany")
    expect(svc).toContain("prisma.expenseSplit.findMany")
    expect(svc).toContain("prisma.contributionSchedule.findMany")
    expect(svc).toContain("prisma.circleEvent.findMany")
    expect(svc).toContain("prisma.circlePoll.findMany")
    expect(svc).toContain("prisma.feedPost.findMany")
    expect(svc).toContain("prisma.circleMember.count")
  })

  it("TR12: reminders reuse the existing notification system (CONTRIBUTION_REMINDER)", () => {
    expect(svc).toContain("createBulkNotifications")
    expect(svc).toContain('type: "CONTRIBUTION_REMINDER"')
  })

  it("TR13: routes are cross-isolated and permission gated", () => {
    expect(route).toContain("CIRCLE_PERMISSIONS.CIRCLE_VIEW")
    expect(route).toContain("CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE")
    expect(route).toContain('circle.type !== "TRAVEL"')
    expect(remindRoute).toContain("CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE")
  })
})

describe("Travel — Dashboard & Member/Admin UX", () => {
  it("TR14: member self-service CTAs link to the shared contribution/expense flows (no read-only)", () => {
    expect(dash).toContain('${base}/contributions`')
    expect(dash).toContain('${base}/expenses`')
    expect(dash).toContain("My Trip Position")
  })

  it("TR15: admin-only actions are gated on canManage", () => {
    expect(dash).toContain('canManage &&')
    expect(dash).toContain("Edit trip")
    expect(dash).toContain("Remind outstanding members")
    expect(dash).toContain("Trip status updated")
  })

  it("TR16: empty states for unconfigured trip, no schedules, no polls, no activity", () => {
    expect(dash).toContain("Trip not configured yet")
    expect(dash).toContain("Only organizers can configure this trip")
    expect(dash).toContain("No contribution schedule yet")
    expect(dash).toContain("No open polls")
    expect(dash).toContain("No upcoming events")
    expect(dash).toContain("No activity yet")
  })

  it("TR17: widgets exposed (countdown, contribution, budget, remaining, members)", () => {
    for (const w of ["Trip Countdown", "Collected", "Budget Used", "Remaining", "Members", "My Trip Position", "Upcoming Deadlines", "Next Activity", "Open Polls"]) {
      expect(dash).toContain(w)
    }
  })

  it("TR18: mobile-safe layout — responsive grids, truncation, no horizontal overflow", () => {
    expect(dash).toContain("grid-cols-2")
    expect(dash).toContain("lg:grid-cols-4")
    expect(dash).toContain("min-w-0")
    expect(dash).toContain("truncate")
    expect(dash).toContain("overflow-y-auto")
  })
})