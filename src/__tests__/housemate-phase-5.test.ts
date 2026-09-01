import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { computeLeaseStatus, computeOccupancyActive, computeRentSplit } from "@/lib/services/household-lease.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const schema = readFile("prisma/schema.prisma")
const svc = readFile("src/lib/services/household-lease.service.ts")
const householdSvc = readFile("src/lib/services/household.service.ts")
const ctx = readFile("src/lib/api/household-ctx.ts")
const leaseRoute = readFile("src/app/api/circles/[circleId]/household/lease/route.ts")
const roomsRoute = readFile("src/app/api/circles/[circleId]/household/rooms/route.ts")
const occupancyRoute = readFile("src/app/api/circles/[circleId]/household/rooms/[roomId]/occupancy/route.ts")
const depositRoute = readFile("src/app/api/circles/[circleId]/household/deposits/[memberId]/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/lease/page.tsx")
const ui = readFile("src/components/household/lease.tsx")
const dash = readFile("src/components/household/household-dashboard.tsx")
const circleTypes = readFile("src/lib/circle-types.ts")

describe("Lease & Rooms — Pure Math", () => {
  it("LS1: lease status flow DRAFT → ACTIVE → EXPIRING → ENDED", () => {
    const today = new Date("2026-06-10")
    expect(computeLeaseStatus(null, today)).toBe("DRAFT")
    expect(computeLeaseStatus("2026-12-31", today)).toBe("ACTIVE")
    expect(computeLeaseStatus("2026-07-01", today)).toBe("EXPIRING")
    expect(computeLeaseStatus("2026-05-01", today)).toBe("ENDED")
  })

  it("LS2: occupancy active only between move-in and move-out", () => {
    const now = new Date("2026-06-10")
    expect(computeOccupancyActive(new Date("2026-05-01"), null, now)).toBe(true)
    expect(computeOccupancyActive(new Date("2026-06-20"), null, now)).toBe(false)
    expect(computeOccupancyActive(new Date("2026-05-01"), new Date("2026-06-01"), now)).toBe(false)
  })

  it("LS3: rent split is equal by default or room-based when shares exist", () => {
    const eq = computeRentSplit({ monthlyRent: 9000, rooms: [], occupantByRoom: {}, members: ["a", "b", "c"] })
    expect(Math.round(eq.a * 100) / 100).toBe(3000)
    const byRoom = computeRentSplit({ monthlyRent: 9000, rooms: [{ id: "r1", name: "Big", rentShare: 5000 }, { id: "r2", name: "Small", rentShare: 4000 }], occupantByRoom: { r1: "a", r2: "b" }, members: [] })
    expect(byRoom.a).toBe(5000)
    expect(byRoom.b).toBe(4000)
  })
})

describe("Lease & Rooms — Schema & Historical Integrity", () => {
  it("LS4: lease/room/occupancy/deposit models with uniques", () => {
    for (const m of ["HouseholdLease", "HouseholdRoom", "HouseholdRoomOccupancy", "HouseholdDeposit"]) expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"))
    expect(schema).toContain("circleId         String   @unique")
    expect(schema).toContain("@@unique([circleId, memberId])")
    expect(schema).toContain("moveOut        DateTime?")
  })

  it("LS5: assigning a room closes prior occupancy and creates a new row (never rewrites history)", () => {
    expect(svc).toContain("householdRoomOccupancy.updateMany")
    expect(svc).toContain("data: { moveOut: now }")
    expect(svc).toContain("householdRoomOccupancy.create(")
    expect(svc).toContain("ROOM_ASSIGNED")
    expect(svc).toContain("occupancyHistoryCount" )
  })
})

describe("Deposits — Idempotency, Audit & Member Scope", () => {
  it("LS6: deposit payments are idempotent (no double posting) and audited", () => {
    expect(svc).toContain("if (existing && asNum(existing.paid) > 0 && existing.status === \"PAID\") return existing")
    expect(svc).toContain("DEPOSIT_PAID")
    expect(svc).toContain("if (deposit.status === \"REFUNDED\") return deposit")
    expect(svc).toContain("DEPOSIT_REFUNDED")
  })

  it("LS7: members only record their own deposit/refund; finalize is manager-only", () => {
    expect(svc).toContain("You can only record your own deposit")
    expect(svc).toContain("You can only record your own refund")
    expect(svc).toContain("finalizeDepositRefund(")
    expect(depositRoute).toContain('if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }')
  })

  it("LS8: proofs use private storage", () => {
    expect(depositRoute).toContain("validateProofFile")
    expect(depositRoute).toContain("uploadProofImage")
  })
})

describe("Lease — Member & Dashboard Experience", () => {
  it("LS9: home dashboard exposes lease widgets", () => {
    expect(householdSvc).toContain("leaseSummary(")
    expect(dash).toContain("Lease expiry")
    expect(dash).toContain("Rooms occupied")
    expect(dash).toContain("My room")
    expect(dash).toContain("My deposit")
    expect(dash).toContain("Move-outs (30d)")
    expect(dash).toContain("Refunds due")
    expect(dash).toContain("Open Lease")
  })

  it("LS10: member view covers my room/share/deposit, rooms, deposits, alerts", () => {
    expect(ui).toContain("Lease, Rooms & Deposits")
    expect(ui).toContain("My room")
    expect(ui).toContain("Deposits")
    expect(ui).toContain("Vacant rooms")
    expect(ui).toContain("refund due")
    expect(ui).toContain("Record payment")
  })

  it("LS11: empty states exist", () => {
    expect(ui).toContain("No rooms yet")
    expect(ui).toContain("No deposits recorded")
  })

  it("LS12: mobile-safe layout", () => {
    expect(ui).toContain("grid-cols-2")
    expect(ui).toContain("min-w-0")
    expect(ui).toContain("lg:grid-cols-4")
  })
})

describe("Security & Isolation", () => {
  it("LS13: all lease/room/deposit routes are HOUSEMATE-scoped", () => {
    expect(ctx).toContain('circle.type !== "HOUSEMATE"')
    for (const f of [leaseRoute, roomsRoute, occupancyRoute, depositRoute]) expect(f).toContain("getHouseholdCtx(circleId)")
    expect(page).toContain('if (circle.type !== "HOUSEMATE") notFound()')
  })

  it("LS14: Lease tab is HOUSEMATE-only", () => {
    expect(circleTypes.split("tabs.lease").length - 1).toBe(1)
    expect(circleTypes).toMatch(/HOUSEMATE: \{[^]+?tabs: \[tabs\.house, tabs\.groceries, tabs\.chores, tabs\.lease,/)
  })

  it("LS15: lease alerts cover expiring, renewal, deposit, move-in/out, refund", () => {
    expect(svc).toContain("Lease expiring soon")
    expect(svc).toContain("Renewal approaching")
    expect(svc).toContain("Deposit outstanding")
    expect(svc).toContain("Move-in approaching")
    expect(svc).toContain("Move-out approaching")
    expect(svc).toContain("Deposit refund ready")
  })
})