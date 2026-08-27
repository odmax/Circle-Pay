import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/stokvel-dashboard.service.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/stokvel/page.tsx")
const dash = readFile("src/components/stokvel/stokvel-dashboard.tsx")
const myContrib = readFile("src/components/stokvel/stokvel-my-contribution.tsx")
const groupPot = readFile("src/components/stokvel/stokvel-group-pot.tsx")
const payoutQueue = readFile("src/components/stokvel/stokvel-payout-queue.tsx")
const contribProgress = readFile("src/components/stokvel/stokvel-contribution-progress.tsx")
const alerts = readFile("src/components/stokvel/stokvel-alerts.tsx")
const quickActions = readFile("src/components/stokvel/stokvel-quick-actions.tsx")
const emptyStates = readFile("src/components/stokvel/stokvel-empty-states.tsx")

describe("Stokvel Dashboard — Service", () => {
  it("SD1: service gates on STOKVEL circle type", () => {
    expect(service).toContain('circle.type !== "STOKVEL"')
    expect(service).toContain('throw new Error("Not a stokvel circle")')
  })

  it("SD2: service uses permission engine not hardcoded role checks", () => {
    expect(service).toContain("hasCirclePermission")
    expect(service).not.toContain('role === "OWNER"')
    expect(service).not.toContain('role === "ADMIN"')
  })

  it("SD3: service checks all required permissions", () => {
    const perms = [
      "CONTRIBUTION_SUBMIT_OWN",
      "CONTRIBUTION_VIEW_ALL",
      "CONTRIBUTION_REVIEW",
      "SCHEDULE_MANAGE",
      "EVENT_MANAGE",
      "POLL_MANAGE",
      "GOAL_CREATE",
      "PAYOUT_APPROVE",
      "REPORT_VIEW",
      "MEMBER_AUDIT_VIEW",
    ]
    for (const p of perms) {
      expect(service).toContain(p)
    }
  })

  it("SD4: service consumes the payout rotation engine as single source of truth", () => {
    expect(service).toContain("getPayoutQueue")
    expect(service).toContain("payout-rotation.service")
    expect(service).toContain("buildPayoutBlock")
    // must not fall back to the obsolete payout-cycle service
    expect(service).not.toContain("payout-cycle.service")
    expect(service).not.toContain("getPayoutSchedule")
    expect(service).not.toContain("getNextPayout")
  })

  it("SD5: service reuses existing contribution schedule, goal, event services", () => {
    expect(service).toContain("getContributionSchedules")
    expect(service).toContain("getGoals")
    expect(service).toContain("getGoalStats")
    expect(service).toContain("getCircleEvents")
  })

  it("SD6: service returns permission flags in data payload", () => {
    expect(service).toContain("permissions: {")
    expect(service).toContain("canSubmitOwn")
    expect(service).toContain("canViewAll")
    expect(service).toContain("canManageSchedule")
    expect(service).toContain("canManagePayouts")
  })
})

describe("Stokvel Dashboard — Page", () => {
  it("SD7: page requires auth and redirects to login", () => {
    expect(page).toContain('redirect("/login")')
    expect(page).toContain("session?.user?.id")
  })

  it("SD8: page calls notFound when service throws (non-stokvel circle)", () => {
    expect(page).toContain("notFound()")
  })

  it("SD9: page renders StokvelDashboard with data, symbol, userId", () => {
    expect(page).toContain("StokvelDashboard")
    expect(page).toContain('data={data}')
    expect(page).toContain('symbol={symbol}')
    expect(page).toContain('userId={session.user.id}')
  })
})

describe("Stokvel Dashboard — Component Exports", () => {
  it("SD10: all stokvel components export correctly", async () => {
    const dashMod = await import("@/components/stokvel/stokvel-dashboard")
    expect(typeof dashMod.StokvelDashboard).toBe("function")
    const myMod = await import("@/components/stokvel/stokvel-my-contribution")
    expect(typeof myMod.StokvelMyContribution).toBe("function")
    const potMod = await import("@/components/stokvel/stokvel-group-pot")
    expect(typeof potMod.StokvelGroupPot).toBe("function")
    const pqMod = await import("@/components/stokvel/stokvel-payout-queue")
    expect(typeof pqMod.StokvelPayoutQueue).toBe("function")
    const cpMod = await import("@/components/stokvel/stokvel-contribution-progress")
    expect(typeof cpMod.StokvelContributionProgress).toBe("function")
    const alMod = await import("@/components/stokvel/stokvel-alerts")
    expect(typeof alMod.StokvelAlerts).toBe("function")
    const qaMod = await import("@/components/stokvel/stokvel-quick-actions")
    expect(typeof qaMod.StokvelQuickActions).toBe("function")
    const esMod = await import("@/components/stokvel/stokvel-empty-states")
    expect(typeof esMod.StokvelEmptyStates).toBe("function")
  })
})

describe("Stokvel Dashboard — My Contribution", () => {
  it("SD11: renders per-month contribution amount", () => {
    expect(myContrib).toContain("per month")
    expect(myContrib).toContain("monthlyContribution")
  })

  it("SD12: covers all contribution statuses in config", () => {
    const statuses = ["PAID", "CONFIRMED", "PENDING_REVIEW", "DUE", "OVERDUE", "UPCOMING", "NONE"]
    for (const s of statuses) {
      expect(myContrib).toContain(`${s}: { label`)
    }
  })

  it("SD13: covers all proof statuses", () => {
    for (const p of ["VERIFIED", "NEEDS_REVIEW", "REJECTED", "PENDING"]) {
      expect(myContrib).toContain(`${p}: { label`)
    }
  })

  it("SD14: shows outstanding in red when > 0", () => {
    expect(myContrib).toContain('my.outstandingAmount > 0 ? "text-red-600"')
  })
})

describe("Stokvel Dashboard — Group Pot", () => {
  it("SD15: shows collected/expected pool", () => {
    expect(groupPot).toContain("group.collected")
    expect(groupPot).toContain("group.expectedPool")
    expect(groupPot).toContain("expected")
  })

  it("SD16: shows collection rate with color thresholds", () => {
    expect(groupPot).toContain("collectionRate >= 80")
    expect(groupPot).toContain("collectionRate >= 50")
  })

  it("SD17: shows members paid and outstanding", () => {
    expect(groupPot).toContain("membersPaid")
    expect(groupPot).toContain("membersOutstanding")
  })

  it("SD18: shows goal progress when present", () => {
    expect(groupPot).toContain("group.goalProgress &&")
    expect(groupPot).toContain("goalProgress.progress")
  })
})

describe("Stokvel Dashboard — Payout Queue", () => {
  it("SD19: renders safe empty state when no schedule", () => {
    expect(payoutQueue).toContain("!payout.hasSchedule")
    expect(payoutQueue).toContain("No payout schedule")
  })

  it("SD20: shows completed/total cycles badge", () => {
    expect(payoutQueue).toContain("completedCycles")
    expect(payoutQueue).toContain("totalCycles")
    expect(payoutQueue).toContain("completed")
  })

  it("SD21: caps schedule list at 8 with more indicator", () => {
    expect(payoutQueue).toContain(".slice(0, 8)")
    expect(payoutQueue).toContain("> 8")
    expect(payoutQueue).toContain("more")
  })

  it("SD22: shows my position and previous payout", () => {
    expect(payoutQueue).toContain("myPosition")
    expect(payoutQueue).toContain("previousPayout")
  })
})

describe("Stokvel Dashboard — Contribution Progress", () => {
  it("SD23: hides other members unless canViewAll", () => {
    expect(contribProgress).toContain("canViewAll ? members : members.filter")
    expect(contribProgress).toContain("canViewAll")
  })

  it("SD24: normal members see only their own row", () => {
    expect(contribProgress).toContain("m.member.id === userId")
  })

  it("SD25: marks the current user row as You", () => {
    expect(contribProgress).toContain(">You<")
    expect(contribProgress).toContain('m.member.id === userId &&')
  })

  it("SD26: covers all status badges and proof badges", () => {
    for (const s of ["PAID", "PARTIAL", "UNPAID"]) {
      expect(contribProgress).toContain(`${s}: { label`)
    }
    for (const p of ["VERIFIED", "NEEDS_REVIEW", "REJECTED", "PENDING"]) {
      expect(contribProgress).toContain(`${p}: { label`)
    }
  })

  it("SD27: shows outstanding column only when canViewAll", () => {
    expect(contribProgress).toContain("{canViewAll && <th")
  })
})

describe("Stokvel Dashboard — Alerts", () => {
  it("SD28: renders nothing when no alerts", () => {
    expect(alerts).toContain("if (alerts.length === 0) return null")
  })

  it("SD29: covers all severity levels", () => {
    for (const s of ["info", "warning", "error"]) {
      expect(alerts).toContain(`${s}: { icon`)
    }
  })
})

describe("Stokvel Dashboard — Quick Actions", () => {
  it("SD30: gates each action behind its permission", () => {
    expect(quickActions).toContain("permissions.canSubmitOwn")
    expect(quickActions).toContain("permissions.canManageEvents")
    expect(quickActions).toContain("permissions.canManagePolls")
    expect(quickActions).toContain("permissions.canManageGoals")
    expect(quickActions).toContain("permissions.canViewReports")
    expect(quickActions).toContain("permissions.canViewPermissions")
    expect(quickActions).toContain("permissions.canManageSchedule")
  })

  it("SD31: View Payouts shown to all members", () => {
    expect(quickActions).toContain('{ label: "View Payouts", href: `/circles/${circleId}/payouts`, icon: Clock, show: true }')
  })

  it("SD32: returns null when no visible actions", () => {
    expect(quickActions).toContain("if (visible.length === 0) return null")
  })
})

describe("Stokvel Dashboard — Empty States", () => {
  it("SD33: renders nothing when nothing is empty", () => {
    expect(emptyStates).toContain("if (visible.length === 0) return null")
  })

  it("SD34: gates goal and event CTAs behind permissions", () => {
    expect(emptyStates).toContain("canManageGoals")
    expect(emptyStates).toContain("canManageEvents")
  })

  it("SD35: schedule empty state gated by canManageSchedule", () => {
    expect(emptyStates).toContain('actionLabel: canManageSchedule ? "View Payouts" : undefined')
  })

  it("SD36: covers schedule, payments, goal, meeting empty states", () => {
    expect(emptyStates).toContain("No payout schedule")
    expect(emptyStates).toContain("No payments yet")
    expect(emptyStates).toContain("No goals set")
    expect(emptyStates).toContain("No upcoming meetings")
  })
})

describe("Stokvel Dashboard — Layout & Responsiveness", () => {
  it("SD37: dashboard uses responsive grid with breakpoints", () => {
    expect(dash).toContain("grid gap-4 sm:grid-cols-2 lg:grid-cols-4")
    expect(dash).toContain("lg:grid-cols-3")
    expect(dash).toContain("sm:grid-cols-2")
  })

  it("SD38: dashboard arranges widgets in col-span layout", () => {
    expect(dash).toContain("lg:col-span-2")
  })

  it("SD39: contribution progress table scrolls horizontally on mobile", () => {
    expect(contribProgress).toContain("overflow-x-auto")
  })
})

describe("Stokvel Dashboard — Page Route Seating", () => {
  it("SD40: dashboard mounts inside circle route", () => {
    expect(page).toContain("getStokvelDashboard")
  })

  it("SD41: page has a back link to circle overview", () => {
    expect(page).toContain('href={`/circles/${circleId}`}')
    expect(page).toContain("ArrowLeft")
  })
})

describe("Stokvel Dashboard — Payout Engine Consistency", () => {
  const cyc = (n: number, status: string, overrides: Record<string, unknown> = {}) => ({
    cycleNumber: n,
    amount: 500,
    status,
    dueDate: null,
    readiness: null,
    completedAt: null,
    paidAt: null,
    confirmedAt: null,
    recipient: { name: `Member ${n}` },
    ...overrides,
  })

  it("SD42: dashboard current beneficiary matches the engine queue active cycle", async () => {
    const { buildPayoutBlock } = await import("@/lib/services/stokvel-dashboard.service")
    const queue = [
      cyc(1, "COMPLETED"),
      cyc(2, "READY", { readiness: "READY" }),
      cyc(3, "UPCOMING"),
    ]
    const block = buildPayoutBlock({ queue, myCycle: null })
    expect(block.currentBeneficiary?.name).toBe("Member 2")
    expect(block.currentBeneficiary?.amount).toBe(500)
    expect(block.currentBeneficiary?.status).toBe("READY")
    // the queue page shows cycle #2 as the active beneficiary → identical
    expect(queue.find((c) => ["READY", "UPCOMING", "BLOCKED", "PENDING_APPROVAL", "APPROVED"].includes(c.status))?.cycleNumber).toBe(2)
  })

  it("SD43: dashboard next beneficiary matches the engine queue next active cycle", async () => {
    const { buildPayoutBlock } = await import("@/lib/services/stokvel-dashboard.service")
    const queue = [
      cyc(1, "READY", { readiness: "READY" }),
      cyc(2, "SKIPPED"),
      cyc(3, "UPCOMING"),
      cyc(4, "UPCOMING"),
    ]
    const block = buildPayoutBlock({ queue, myCycle: null })
    // skipped cycles are represented but not promoted to next beneficiary
    expect(block.nextBeneficiary?.name).toBe("Member 3")
    expect(queue[1].status).toBe("SKIPPED")
  })

  it("SD44: readiness/blockers match the engine queue readiness for BLOCKED current", async () => {
    const { buildPayoutBlock } = await import("@/lib/services/stokvel-dashboard.service")
    const queue = [
      cyc(1, "BLOCKED", { readiness: "2 member contributions are still outstanding; Available funds (100) are less than the payout amount (500)" }),
      cyc(2, "UPCOMING"),
    ]
    const block = buildPayoutBlock({ queue, myCycle: null })
    expect(block.readiness).toBe("BLOCKED")
    expect(block.blockers).toHaveLength(2)
    expect(block.blockers[0]).toContain("outstanding")
    // identical to the queue row's readiness string
    expect(block.blockers.join("; ")).toBe(queue[0].readiness)
  })

  it("SD45: member queue position matches engine myCycle", async () => {
    const { buildPayoutBlock } = await import("@/lib/services/stokvel-dashboard.service")
    const queue = [cyc(1, "READY", { readiness: "READY" }), cyc(2, "UPCOMING"), cyc(3, "UPCOMING")]
    const block = buildPayoutBlock({
      queue,
      myCycle: { cycleNumber: 3, status: "UPCOMING", amount: 500, dueDate: null },
    })
    expect(block.myPosition).toBe(3)
    expect(queue.find((c) => c.cycleNumber === block.myPosition)?.cycleNumber).toBe(3)
  })

  it("SD46: completed/skipped/deferred cycles are represented consistently in schedule & progress", async () => {
    const { buildPayoutBlock } = await import("@/lib/services/stokvel-dashboard.service")
    const queue = [
      cyc(1, "COMPLETED", { confirmedAt: new Date("2026-01-10") }),
      cyc(2, "SKIPPED"),
      cyc(3, "DEFERRED"),
      cyc(4, "PAID", { paidAt: new Date("2026-02-01") }),
      cyc(5, "UPCOMING"),
    ]
    const block = buildPayoutBlock({ queue, myCycle: null })
    // completed/paid count matches engine progress definition
    const done = ["COMPLETED", "CONFIRMED_RECEIVED", "PAID"]
    expect(block.completedCycles).toBe(queue.filter((c) => done.includes(c.status)).length)
    expect(block.completedCycles).toBe(2)
    // every cycle appears in the schedule with its true status
    expect(block.schedule.map((s) => s.status)).toEqual(["COMPLETED", "SKIPPED", "DEFERRED", "PAID", "UPCOMING"])
    // previous payout is the most recent completed/paid cycle
    expect(block.previousPayout?.name).toBe("Member 4")
    expect(block.previousPayout?.completedAt).toBeDefined()
  })

  it("SD47: dashboard payout block honours per-beneficiary amount from the queue", async () => {
    const { buildPayoutBlock } = await import("@/lib/services/stokvel-dashboard.service")
    const queue = [cyc(1, "READY", { amount: 1200, readiness: "READY" }), cyc(2, "UPCOMING", { amount: 1200 })]
    const block = buildPayoutBlock({ queue, myCycle: { cycleNumber: 2, status: "UPCOMING", amount: 1200, dueDate: null } })
    expect(block.currentBeneficiary?.amount).toBe(1200)
    expect(queue[0].amount).toBe(1200)
  })
})
