import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { computeDocumentAlerts } from "@/lib/services/travel-document.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/travel-document.service.ts")
const smartSvc = readFile("src/lib/services/travel.service.ts")
const itinerarySvc = readFile("src/lib/services/travel-itinerary.service.ts")
const ctx = readFile("src/lib/api/travel-ctx.ts")
const docsRoute = readFile("src/app/api/circles/[circleId]/travel/documents/route.ts")
const docsIdRoute = readFile("src/app/api/circles/[circleId]/travel/documents/[docId]/route.ts")
const cron = readFile("src/app/api/cron/opportunity-reminders/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/travel-documents/page.tsx")
const ui = readFile("src/components/travel/travel-documents.tsx")
const dash = readFile("src/components/travel/travel-dashboard.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Travel Documents — Schema & Alerts (pure)", () => {
  it("TD1: TravelDocument model with type enum and private fields", () => {
    expect(schema).toMatch(/^model TravelDocument \{/m)
    const en = (schema.match(/enum TravelDocumentType \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["PASSPORT", "VISA", "FLIGHT_TICKET", "HOTEL_CONFIRMATION", "TRAVEL_INSURANCE", "BOOKING_CONFIRMATION", "VACCINATION_HEALTH", "OTHER"]) expect(en).toContain(v)
    for (const f of ["ownerUserId", "url", "expiryDate", "relatedItemId"]) expect(schema).toMatch(new RegExp(`^  ${f}\\s+`, "m"))
  })

  it("TD2: expiry alerts compute days and required documents are flagged", () => {
    const soon = new Date(Date.now() + 10 * 86400000)
    const far = new Date(Date.now() + 200 * 86400000)
    const alerts = computeDocumentAlerts([{ type: "PASSPORT", expiryDate: soon }, { type: "TRAVEL_INSURANCE", expiryDate: far }], true)
    expect(alerts.missing).toEqual([])
    expect(alerts.expiring.length).toBe(1)
    expect(alerts.expiring[0].type).toBe("PASSPORT")
    expect(alerts.expiring[0].days).toBe(10)
    const missing = computeDocumentAlerts([{ type: "VISA", expiryDate: far }], true)
    expect(missing.missing).toContain("PASSPORT")
    expect(missing.missing).toContain("TRAVEL_INSURANCE")
  })

  it("TD3: notification types exist for expiring/missing documents", () => {
    expect(schema).toContain("TRAVEL_DOC_EXPIRING")
    expect(schema).toContain("TRAVEL_DOC_MISSING")
  })
})

describe("Travel Documents — Privacy & Ownership", () => {
  it("TD4: members only see their own document URLs; organizer oversight excludes private URLs", () => {
    expect(svc).toContain("ownerUserId: viewerUserId")
    expect(svc).toContain("myDocuments: mine,")
    expect(svc).toContain("memberDocCounts")
    expect(svc).not.toContain("counts: allDocs.map")
  })

  it("TD5: upload requires self unless manager; delete is owner-scoped", () => {
    expect(docsRoute).toContain("You can only upload your own travel documents")
    expect(docsRoute).toContain("if (!ctx.isManager && ownerUserId !== ctx.userId)")
    expect(svc).toContain("You can only delete your own documents")
    expect(docsIdRoute).toContain('message.includes("own")')
    expect(svc).toContain("if (!isManager && doc.ownerUserId !== actorUserId && doc.createdById !== actorUserId)")
  })

  it("TD6: cross-circle/travel-only isolation on document routes", () => {
    expect(ctx).toContain("circle.type !== \"TRAVEL\"")
    expect(docsRoute).toContain("getTravelCtx(circleId)")
    expect(docsIdRoute).toContain("getTravelCtx(circleId)")
    expect(page).toContain('if (circle.type !== "TRAVEL") notFound()')
  })
})

describe("Travel Documents — Alerts & Notifications", () => {
  it("TD7: document alert sweep notifies owners privately (not member-wide) and dedupes per day", () => {
    expect(svc).toContain("sweepTravelDocumentAlerts(")
    expect(svc).toContain("createNotification({ userId: m.userId")
    expect(svc).toContain('type: "TRAVEL_DOC_MISSING"')
    expect(svc).toContain('type: "TRAVEL_DOC_EXPIRING"')
    expect(svc).toContain("docAlertsNotifiedDate")
    expect(cron).toContain("sweepTravelDocumentAlerts")
  })
})

describe("Live Trip Mode — Today Experience", () => {
  it("TD8: dashboard exposes a today block with itinerary, next item, hotel/transport, meeting point, live spend", () => {
    expect(svc).toContain("getTodayContext(")
    expect(smartSvc).toContain("todayItems")
    expect(smartSvc).toContain("upcomingBooking")
    expect(smartSvc).toContain("meetingPoint")
    expect(smartSvc).toContain("liveSpendToday")
    expect(dash).toContain('t.status === "ACTIVE"')
    expect(dash).toContain("Live trip · today")
    expect(dash).toContain("Today&apos;s itinerary")
  })

  it("TD9: quick add expense + settlement actions are available in live mode", () => {
    expect(dash).toContain("Quick expense")
    expect(dash).toContain("Settlement")
    expect(dash).toContain("Emergency")
  })
})

describe("Itinerary-Changing Notifications & Audit", () => {
  it("TD10: itinerary updates keep previous values in audit history and notify affected members", () => {
    expect(itinerarySvc).toContain("oldValues")
    expect(itinerarySvc).toContain('action: "TRAVEL_ITINERARY_UPDATED"')
    expect(itinerarySvc).toContain("notifyAssigned(")
    expect(itinerarySvc).toContain("Meeting point changed")
  })

  it("TD11: client highlights recently changed itinerary items", () => {
    const itineraryUi = readFile("src/components/travel/travel-itinerary.tsx")
    expect(itineraryUi).toContain("recentlyChanged(")
    expect(itineraryUi).toContain("Changed")
  })
})

describe("Travel Documents — Surface & Mobile", () => {
  it("TD12: documents page & dashboard docs widget exist", () => {
    expect(ui).toContain("Travel Documents")
    expect(ui).toContain("Missing required document")
    expect(dash).toContain("Travel documents")
    expect(dash).toContain("Required missing")
    expect(dash).toContain("Expiring soon")
  })

  it("TD13: Docs tab is TRAVEL-only", () => {
    expect(circleTypes.split("tabs.documents").length - 1).toBe(1)
    expect(circleTypes).toMatch(/TRAVEL: \{[^]+?tabs: \[tabs\.trip, tabs\.itinerary, tabs\.budget, tabs\.documents,/)
  })

  it("TD14: mobile-safe layout on documents page", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("truncate")
  })

  it("TD15: empty state with upload CTA", () => {
    expect(ui).toContain("No documents yet")
    expect(ui).toContain("Upload first document")
  })
})