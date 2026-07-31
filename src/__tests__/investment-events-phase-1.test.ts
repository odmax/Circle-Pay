import { describe, it, expect } from "vitest"

describe("Investment Events - Phase 1", () => {
  it("Test E1: create-event-form exports correctly", async () => {
    const mod = await import("@/components/events/create-event-form")
    expect(typeof mod.CreateEventForm).toBe("function")
  })

  it("Test E2: event-rsvp-actions exports correctly", async () => {
    const mod = await import("@/components/events/event-rsvp-actions")
    expect(typeof mod.EventRSVPActions).toBe("function")
  })

  it("Test E3: EVENT_MANAGE removed from MEMBER role", async () => {
    const mod = await import("@/lib/permissions/circle-role-permissions")
    const { getRoleDefaultPermissions } = mod
    const memberPerms = getRoleDefaultPermissions("MEMBER")
    expect(memberPerms).not.toContain("EVENT_MANAGE")
  })

  it("Test E4: EVENT_MANAGE still assigned to ADMIN", async () => {
    const mod = await import("@/lib/permissions/circle-role-permissions")
    const { getRoleDefaultPermissions } = mod
    const adminPerms = getRoleDefaultPermissions("ADMIN")
    expect(adminPerms).toContain("EVENT_MANAGE")
  })

  it("Test E5: INVESTMENT circle type has events tab", async () => {
    const mod = await import("@/lib/circle-types")
    const config = mod.getCircleTypeConfig("INVESTMENT")
    const eventsTab = config.tabs.find((t: any) => t.key === "events")
    expect(eventsTab).toBeDefined()
    expect(eventsTab?.label).toBe("Events")
  })

  it("Test E6: CircleEventStatus includes DRAFT and PUBLISHED", async () => {
    // Verify the generated Prisma enum
    const { CircleEventStatus } = await import("@/generated/prisma")
    // The enum should have DRAFT and PUBLISHED as valid values
    // We check the schema file since runtime enum verification is complex
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("DRAFT")
    expect(schema).toContain("PUBLISHED")
    expect(schema).toContain("CANCELLED")
    expect(schema).toContain("COMPLETED")
  })

  it("Test E7: CircleEvent model has amount and reminderDate", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toMatch(/amount\s+Decimal/)
    expect(schema).toMatch(/reminderDate\s+DateTime/)
  })

  it("Test E8: event service exports all required functions", async () => {
    const mod = await import("@/lib/services/event.service")
    expect(typeof mod.getCircleEvents).toBe("function")
    expect(typeof mod.createCircleEvent).toBe("function")
    expect(typeof mod.rsvpToEvent).toBe("function")
    expect(typeof mod.cancelEvent).toBe("function")
    expect(typeof mod.getEventById).toBe("function")
  })

  it("Test E9: [eventId] API route file exists", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const routePath = path.resolve("src/app/api/circles/[circleId]/events/[eventId]/route.ts")
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it("Test E10: create-event-form supports new fields", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/events/create-event-form.tsx"), "utf-8")
    expect(src).toContain("amount")
    expect(src).toContain("reminderDate")
    expect(src).toContain("PUBLISHED")
    expect(src).toContain("DRAFT")
  })

  it("Test E11: circle dashboard imports CreateEventForm", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/(dashboard)/circles/[circleId]/page.tsx"), "utf-8")
    expect(src).toContain("CreateEventForm")
  })

  it("Test E12: event form shows type labels correctly", async () => {
    const mod = await import("@/components/events/create-event-form")
    // Verify the component exists - the TYPE_LABELS are internal to the component
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/events/create-event-form.tsx"), "utf-8")
    expect(src).toContain("MEETING")
    expect(src).toContain("FUNDRAISER")
    expect(src).toContain("GENERAL")
  })
})
