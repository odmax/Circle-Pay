import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/travel-itinerary.service.ts")
const ctx = readFile("src/lib/api/travel-ctx.ts")
const route = readFile("src/app/api/circles/[circleId]/itinerary/route.ts")
const itemRoute = readFile("src/app/api/circles/[circleId]/itinerary/[itemId]/route.ts")
const docRoute = readFile("src/app/api/circles/[circleId]/itinerary/[itemId]/documents/route.ts")
const travelSvc = readFile("src/lib/services/travel.service.ts")
const cron = readFile("src/app/api/cron/opportunity-reminders/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/itinerary/page.tsx")
const dash = readFile("src/components/travel/travel-dashboard.tsx")
const ui = readFile("src/components/travel/travel-itinerary.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Itinerary & Bookings — Schema", () => {
  it("TR20: schema defines itinerary, booking, booking document and assignment models", () => {
    for (const m of ["TravelItineraryItem", "TravelBooking", "TravelBookingDocument", "TravelItineraryAssignment"]) {
      expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"))
    }
  })

  it("TR21: required enums exist (item type, item status, payment status)", () => {
    const it = (schema.match(/enum TravelItineraryType \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["FLIGHT", "HOTEL", "TRANSPORT", "ACTIVITY", "RESTAURANT", "MEETING_POINT", "FREE_TIME", "CUSTOM"]) expect(it).toContain(v)
    const st = (schema.match(/enum TravelItemStatus \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["PLANNED", "BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED"]) expect(st).toContain(v)
    const pay = (schema.match(/enum TravelPaymentStatus \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["PENDING", "UNPAID", "PARTIAL", "PAID", "REFUNDED"]) expect(pay).toContain(v)
  })

  it("TR22: one booking per item, assignments are unique, docs cascade with the booking", () => {
    expect(schema).toContain("itineraryItemId   String?             @unique")
    expect(schema).toContain("@@unique([itineraryItemId, userId])")
    expect(schema).toContain('booking    TravelBooking @relation(fields: [bookingId], references: [id], onDelete: Cascade)')
  })
})

describe("Itinerary & Bookings — CRUD & Assignments", () => {
  it("TR23: itinerary item + booking creation/update/cancel and member assignment flows exist", () => {
    for (const fn of ["createItineraryItem", "updateItineraryItem", "cancelItineraryItem", "assignItineraryMembers", "addBookingDocument", "recordBookingPayment", "sweepTravelItineraryReminders"]) {
      expect(svc).toContain(`export async function ${fn}`)
    }
    expect(svc).toContain("async function upsertBookingForItem(")
    expect(svc).toContain("travelItineraryAssignment.createMany")
  })

  it("TR24: bookings are only supported for flight/hotel/transport/activity", () => {
    expect(svc).toContain("const BOOKABLE = new Set(BOOKING_TYPES)")
    expect(svc).toContain("Bookings are only supported for flights, hotels, transport and activities")
  })
})

describe("Itinerary & Bookings — Finance & No Duplicate Records", () => {
  it("TR25: booking payments reuse the existing circle expense ledger, idempotently", () => {
    expect(svc).toContain("createExpense")
    expect(svc).toContain("ledgerExpenseId")
    expect(svc).toContain('if (status === "PAID" && !(booking.metadata as any)?.ledgerExpenseId)')
    expect(svc).toContain('splitType: "EQUAL"')
  })

  it("TR26: private booking docs use the shared private storage upload", () => {
    expect(docRoute).toContain("validateProofFile")
    expect(docRoute).toContain("uploadProofImage")
    expect(svc).toContain("canSeeDocs")
  })
})

describe("Itinerary & Bookings — Security & Isolation", () => {
  it("TR27: cross-circle/trip access blocked and TRAVEL-only", () => {
    expect(ctx).toContain("CIRCLE_PERMISSIONS.CIRCLE_VIEW")
    expect(ctx).toContain('circle.type !== "TRAVEL"')
    expect(ctx).toContain("prisma.travelTrip.findUnique")
    expect(page).toContain('if (circle.type !== "TRAVEL") notFound()')
  })

  it("TR28: member documents are only listed to assigned members and managers", () => {
    expect(svc).toContain("canSeeDocs = isManager || assignedIds.includes(viewerUserId)")
    expect(route).toContain("isManager")
  })

  it("TR29: all write actions require the organizer permission", () => {
    expect(itemRoute).toContain("if (!ctx.isManager) return NextResponse.json({ error: \"Forbidden\" }")
    expect(route).toContain("if (!ctx.isManager) return NextResponse.json({ error: \"Forbidden\" }")
    expect(docRoute).toContain("if (!ctx.isManager) return NextResponse.json({ error: \"Forbidden\" }")
  })
})

describe("Itinerary & Bookings — Notifications (deduped, assigned only)", () => {
  it("TR30: affected members only are notified and approaching reminders are deduped", () => {
    expect(svc).toContain("createBulkNotifications")
    expect(svc).toContain("notifiedApproaching")
    expect(svc).toContain('status: { notIn: ["CANCELLED", "COMPLETED"] }')
    expect(cron).toContain("sweepTravelItineraryReminders")
  })
})

describe("Itinerary & Bookings — Dashboard & Member/Admin UX", () => {
  it("TR31: travel dashboard integrates itinerary widgets (today/next, flight, hotel, activity, completion, missing)", () => {
    expect(travelSvc).toContain("getItineraryDashboardSummary")
    expect(travelSvc).toContain("bookingCompletionPct")
    expect(travelSvc).toContain("missingBookingsCount")
    expect(dash).toContain("Today / next")
    expect(dash).toContain("Next flight")
    expect(dash).toContain("Hotel / check-in")
    expect(dash).toContain("Upcoming activity")
    expect(dash).toContain("Bookings complete")
  })

  it("TR32: itinerary page + client support add/edit/cancel, assign, upload docs, payment status", () => {
    expect(ui).toContain("Add item")
    expect(ui).toContain("Edit itinerary item")
    expect(ui).toContain("Cancel")
    expect(ui).toContain("Uploading...")
    expect(ui).toContain("Payment:")
    expect(ui).toContain("Assigned members")
  })

  it("TR33: itinerary tab is TRAVEL-only and other types untouched", () => {
    // Referenced exactly once in the whole file: the TRAVEL config's tabs array.
    expect(circleTypes.split("tabs.itinerary").length - 1).toBe(1)
    expect(circleTypes).toMatch(/TRAVEL: \{[^]+?tabs: \[tabs\.trip, tabs\.itinerary,/)
  })

  it("TR34: mobile-safe layout (no horizontal overflow)", () => {
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("overflow-y-auto")
    expect(ui).toContain("grid-cols-2")
  })

  it("TR35: empty state for an unbuilt itinerary with permission-gated CTA", () => {
    expect(ui).toContain("No itinerary items yet")
    expect(ui).toContain("Add first item")
    expect(ui).toContain("canManage")
  })
})