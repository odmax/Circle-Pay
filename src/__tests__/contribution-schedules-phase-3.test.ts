import { describe, it, expect } from "vitest"

describe("Contribution Schedules & Reminder Engine - Phase 3", () => {
  it("Test S1: schedule service exports all required functions", async () => {
    const mod = await import("@/lib/services/contribution-schedule.service")
    expect(typeof mod.getContributionSchedules).toBe("function")
    expect(typeof mod.createContributionSchedule).toBe("function")
    expect(typeof mod.updateContributionSchedule).toBe("function")
    expect(typeof mod.deleteContributionSchedule).toBe("function")
    expect(typeof mod.generateScheduledContributions).toBe("function")
    expect(typeof mod.promoteDueContributions).toBe("function")
    expect(typeof mod.sendContributionReminders).toBe("function")
    expect(typeof mod.sweepOverdueContributions).toBe("function")
    expect(typeof mod.acknowledgeContributionReminder).toBe("function")
    expect(typeof mod.runContributionJobs).toBe("function")
  })

  it("Test S2: schema has ContributionSchedule model and frequency enum", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("model ContributionSchedule")
    expect(schema).toContain("enum ContributionScheduleFrequency")
    for (const f of ["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]) {
      expect(schema).toContain(f)
    }
    expect(schema).toMatch(/gracePeriodDays\s+Int\s+@default\(0\)/)
    expect(schema).toMatch(/lateFee\s+Decimal\?/)
    expect(schema).toMatch(/autoGenerate\s+Boolean\s+@default\(true\)/)
    expect(schema).toMatch(/nextDueDate\s+DateTime\?/)
    expect(schema).toMatch(/lastGeneratedAt\s+DateTime\?/)
  })

  it("Test S3: schema has ContributionReminder model with unique stage", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("model ContributionReminder")
    expect(schema).toContain("@@unique([contributionId, stage])")
  })

  it("Test S4: ContributionStatus includes UPCOMING and DUE", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    const enumMatch = schema.match(/enum ContributionStatus \{([^}]+)\}/)
    expect(enumMatch).not.toBeNull()
    expect(enumMatch![1]).toContain("UPCOMING")
    expect(enumMatch![1]).toContain("DUE")
  })

  it("Test S5: Contribution has schedule and reminder fields", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toMatch(/scheduleId\s+String\?/)
    expect(schema).toMatch(/dueDate\s+DateTime\?/)
    expect(schema).toMatch(/periodLabel\s+String\?/)
    expect(schema).toMatch(/overdueAt\s+DateTime\?/)
    expect(schema).toMatch(/lateFeeApplied\s+Boolean\s+@default\(false\)/)
    expect(schema).toMatch(/lateFeeAmount\s+Decimal\?/)
    expect(schema).toMatch(/acknowledgedAt\s+DateTime\?/)
  })

  it("Test S6: date helpers compute next periods correctly", async () => {
    const { nextPeriodDate, addDays } = await import("@/lib/services/contribution-schedule.service")
    const base = new Date(2026, 0, 15)
    expect(nextPeriodDate(base, "WEEKLY")).toEqual(new Date(2026, 0, 22))
    expect(nextPeriodDate(base, "FORTNIGHTLY")).toEqual(new Date(2026, 0, 29))
    expect(nextPeriodDate(base, "MONTHLY")).toEqual(new Date(2026, 1, 15))
    expect(nextPeriodDate(base, "QUARTERLY")).toEqual(new Date(2026, 3, 15))
    expect(nextPeriodDate(base, "ANNUALLY")).toEqual(new Date(2027, 0, 15))
    expect(nextPeriodDate(base, "CUSTOM")).toEqual(new Date(2026, 1, 14))
    expect(addDays(base, 7)).toEqual(new Date(2026, 0, 22))
  })

  it("Test S7: period labels format monthly and weekly", async () => {
    const { formatPeriodLabel } = await import("@/lib/services/contribution-schedule.service")
    expect(formatPeriodLabel(new Date(2026, 7, 5), "MONTHLY")).toBe("2026-08")
    const weekly = formatPeriodLabel(new Date(2026, 0, 15), "WEEKLY")
    expect(weekly).toMatch(/^2026-W\d+$/)
  })

  it("Test S8: schedule permissions exist in CIRCLE_PERMISSIONS", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    expect(CIRCLE_PERMISSIONS.SCHEDULE_MANAGE).toBe("SCHEDULE_MANAGE")
    expect(CIRCLE_PERMISSIONS.SCHEDULE_VIEW).toBe("SCHEDULE_VIEW")
  })

  it("Test S9: schedule permissions mapped to roles", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/permissions/circle-role-permissions.ts"), "utf-8")
    const adminBlock = src.slice(0, src.indexOf("TREASURER_PERMISSIONS"))
    expect(adminBlock).toContain("P.SCHEDULE_MANAGE")
    expect(adminBlock).toContain("P.SCHEDULE_VIEW")
    const memberBlock = src.slice(src.indexOf("MEMBER_PERMISSIONS"), src.indexOf("VIEWER_PERMISSIONS"))
    expect(memberBlock).toContain("P.SCHEDULE_VIEW")
    expect(memberBlock).not.toContain("P.SCHEDULE_MANAGE")
  })

  it("Test S10: cron scheduler route exists with auth guard", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/api/cron/contribution-scheduler/route.ts"), "utf-8")
    expect(src).toContain("runContributionJobs")
    expect(src).toContain("CRON_SECRET")
    expect(src).toContain("Unauthorized")
  })

  it("Test S11: schedule CRUD API routes exist", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const root = "src/app/api/circles/[circleId]/contribution-schedules"
    expect(fs.existsSync(path.resolve(`${root}/route.ts`))).toBe(true)
    expect(fs.existsSync(path.resolve(`${root}/[scheduleId]/route.ts`))).toBe(true)
    const ack = fs.readFileSync(path.resolve("src/app/api/circles/[circleId]/contributions/[contributionId]/acknowledge/route.ts"), "utf-8")
    expect(ack).toContain("acknowledgeContributionReminder")
  })

  it("Test S12: create schedule form requires amount, frequency, first due date", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/create-contribution-schedule-form.tsx"), "utf-8")
    expect(src).toContain("First due date is required")
    expect(src).toContain("Amount must be positive")
    expect(src).toContain("contribution-schedules")
    expect(src).toContain("FORTNIGHTLY")
    expect(src).toContain("QUARTERLY")
    expect(src).toContain("ANNUALLY")
    expect(src).toContain("gracePeriodDays")
    expect(src).toContain("lateFee")
    expect(src).toContain("autoGenerate")
  })

  it("Test S13: schedule card renders with manage actions", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/contribution-schedule-card.tsx"), "utf-8")
    expect(src).toContain("Pause")
    expect(src).toContain("Activate")
    expect(src).toContain("Delete")
    expect(src).toContain("gracePeriodDays")
  })

  it("Test S14: contributions page loads schedules and renders widgets", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/(dashboard)/circles/[circleId]/contributions/page.tsx"), "utf-8")
    expect(src).toContain("getContributionSchedules")
    expect(src).toContain("CreateContributionScheduleForm")
    expect(src).toContain("ContributionScheduleCard")
    expect(src).toContain("summary.upcoming")
    expect(src).toContain("summary.dueToday")
    expect(src).toContain("summary.overdue")
    expect(src).toContain("summary.collectionRate")
    expect(src).toContain("summary.collectionProgress")
    expect(src).toContain("membersOutstanding")
  })

  it("Test S15: status badge includes UPCOMING and DUE", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/contribution-status-badge.tsx"), "utf-8")
    expect(src).toContain("UPCOMING: { label: \"Upcoming\"")
    expect(src).toContain("DUE: { label: \"Due\"")
  })

  it("Test S16: member status service returns schedule data", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/member-status.service.ts"), "utf-8")
    expect(src).toContain("nextDue")
    expect(src).toContain("outstandingBalance")
    expect(src).toContain("daysRemaining")
    expect(src).toContain("paymentHistory")
    expect(src).toContain("lateFeeAmount")
  })

  it("Test S17: my-status page renders schedule dashboard", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/(dashboard)/circles/[circleId]/my-status/page.tsx"), "utf-8")
    expect(src).toContain("Next Contribution")
    expect(src).toContain("Outstanding Balance")
    expect(src).toContain("Overdue Contributions")
    expect(src).toContain("Payment History")
    expect(src).toContain("remaining")  })

  it("Test S18: summary service computes schedule metrics", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/contribution.service.ts"), "utf-8")
    expect(src).toContain("const due = Number(totalDue._sum.amount ?? 0)")
    expect(src).toContain("const overdue = Number(totalOverdue._sum.amount ?? 0)")
    expect(src).toContain("const upcoming = Number(totalUpcoming._sum.amount ?? 0)")
    expect(src).toContain("collectionProgress")
    expect(src).toContain("collectionRate")
    expect(src).toContain("membersOutstanding")
    expect(src).toContain("dueToday")
  })

  it("Test S19: addContribution cancels matching scheduled records", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/contribution.service.ts"), "utf-8")
    expect(src).toContain("periodLabel: data.contributionMonth")
    expect(src).toContain('status: { in: ["UPCOMING", "DUE"] }')
    expect(src).toContain('data: { status: "CANCELLED" }')
  })

  it("Test S20: reminder engine covers all stages and overdue sweep", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/contribution-schedule.service.ts"), "utf-8")
    expect(src).toContain("7_DAYS")
    expect(src).toContain("3_DAYS")
    expect(src).toContain("1_DAY")
    expect(src).toContain('"DUE"')
    expect(src).toContain("REMINDER_SENT")
    expect(src).toContain("CONTRIBUTION_OVERDUE")
    expect(src).toContain("lateFeeApplied")
    expect(src).toContain("acknowledgedAt")
    expect(src).toContain("contributionId_stage")
  })
})
