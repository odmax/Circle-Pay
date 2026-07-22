import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectInvestorAgreement: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    projectOwnershipSnapshot: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    projectOwnershipEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    projectCapitalTransaction: {
      findMany: vi.fn(),
    },
    projectParticipant: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/services/project.service", () => ({
  addProjectActivity: vi.fn().mockResolvedValue({}),
}))

import { prisma } from "@/lib/prisma"
import { createInvestorAgreement, transitionAgreement, updateAgreementTerms } from "@/lib/services/project-investor.service"
import { proposeOwnershipSnapshot, approveOwnershipSnapshot, rejectOwnershipSnapshot, adjustOwnershipEntry } from "@/lib/services/project-ownership.service"

const mockPrisma = vi.mocked(prisma)

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Test 1: Investor agreement creation validation ────
describe("Phase B: Investor Agreements", () => {
  it("Test 1: rejects zero principal", async () => {
    await expect(
      createInvestorAgreement("proj1", "participant1", {
        agreementType: "EQUITY", principal: 0,
      })
    ).rejects.toThrow("Principal must be greater than zero")
  })

  it("Test 2: rejects ownership percentage > 100", async () => {
    await expect(
      createInvestorAgreement("proj1", "participant1", {
        agreementType: "EQUITY", principal: 100000, ownershipPercentage: 150,
      })
    ).rejects.toThrow("Ownership percentage must be between 0 and 100")
  })

  it("Test 3: rejects invalid interest rate", async () => {
    await expect(
      createInvestorAgreement("proj1", "participant1", {
        agreementType: "LOAN", principal: 100000, interestRate: 1.5,
      })
    ).rejects.toThrow("Interest rate must be between 0 and 1")
  })

  it("Test 4: creates agreement with correct version", async () => {
    ;(mockPrisma.projectParticipant.findUnique as any).mockResolvedValue({ id: "participant1" })
    ;(mockPrisma.projectInvestorAgreement.count as any).mockResolvedValue(1)
    ;(mockPrisma.projectInvestorAgreement.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "agreement1", ...args.data })
    )

    const result = await createInvestorAgreement("proj1", "participant1", {
      agreementType: "EQUITY", principal: 500000, ownershipPercentage: 20,
    })

    expect(result.version).toBe(2) // 1 existing + 1
    expect(result.status).toBe("DRAFT")
  })
})

// ─── Test 5: Agreement lifecycle ────
describe("Phase B: Agreement Lifecycle", () => {
  it("Test 5: cannot transition from DRAFT to ACTIVE directly", async () => {
    ;(mockPrisma.projectInvestorAgreement.findUnique as any).mockResolvedValue({
      id: "agreement1", status: "DRAFT",
    })

    await expect(transitionAgreement("agreement1", "ACTIVE", "admin1")).rejects.toThrow(
      "Cannot transition agreement from DRAFT to ACTIVE"
    )
  })

  it("Test 6: valid DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE", async () => {
    ;(mockPrisma.projectInvestorAgreement.findUnique as any)
      .mockResolvedValueOnce({ id: "agreement1", status: "DRAFT" })
      .mockResolvedValueOnce({ id: "agreement1", status: "PENDING_APPROVAL" })
      .mockResolvedValueOnce({ id: "agreement1", status: "APPROVED" })
    ;(mockPrisma.projectInvestorAgreement.update as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "agreement1", ...args.data })
    )

    const step1 = await transitionAgreement("agreement1", "PENDING_APPROVAL", "admin1")
    expect(step1.status).toBe("PENDING_APPROVAL")

    const step2 = await transitionAgreement("agreement1", "APPROVED", "admin1")
    expect(step2.status).toBe("APPROVED")

    const step3 = await transitionAgreement("agreement1", "ACTIVE", "admin1")
    expect(step3.status).toBe("ACTIVE")
  })
})

// ─── Test 7: Agreement update restrictions ────
describe("Phase B: Agreement Updates", () => {
  it("Test 7: cannot modify a finalized agreement", async () => {
    ;(mockPrisma.projectInvestorAgreement.findUnique as any).mockResolvedValue({
      id: "agreement1", status: "ACTIVE", version: 1,
    })

    await expect(
      updateAgreementTerms("agreement1", "admin1", { principal: 200000 })
    ).rejects.toThrow("Cannot modify a finalized agreement")
  })
})

// ─── Test 8: Ownership snapshot proposal ────
describe("Phase B: Ownership Snapshot", () => {
  it("Test 8: rejects proposal with no eligible capital", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findFirst as any).mockResolvedValue(null)
    ;(mockPrisma.projectCapitalTransaction.findMany as any).mockResolvedValue([])

    await expect(proposeOwnershipSnapshot("proj1", "admin1")).rejects.toThrow(
      "No eligible capital contributions to base ownership on"
    )
  })

  it("Test 9: rejects proposal when one already exists", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findFirst as any).mockResolvedValue({
      id: "existing", status: "PROPOSED",
    })

    await expect(proposeOwnershipSnapshot("proj1", "admin1")).rejects.toThrow(
      "A proposed snapshot already exists"
    )
  })
})

// ─── Test 10: Ownership approval validation ────
describe("Phase B: Ownership Approval", () => {
  it("Test 10: rejects approval when ownership doesn't total 100%", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findUnique as any).mockResolvedValue({
      id: "snap1", status: "PROPOSED", projectId: "proj1", version: 1,
      entries: [
        { ownershipPercentage: 60 },
        { ownershipPercentage: 20 },
      ],
    })

    await expect(approveOwnershipSnapshot("snap1", "admin1")).rejects.toThrow(
      "Ownership must total 100%"
    )
  })

  it("Test 11: rejects approval of non-PROPOSED snapshot", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findUnique as any).mockResolvedValue({
      id: "snap1", status: "EFFECTIVE",
    })

    await expect(approveOwnershipSnapshot("snap1", "admin1")).rejects.toThrow(
      "Can only approve PROPOSED snapshots"
    )
  })
})

// ─── Test 12: Ownership rejection ────
describe("Phase B: Ownership Rejection", () => {
  it("Test 12: rejects rejection of non-PROPOSED snapshot", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findUnique as any).mockResolvedValue({
      id: "snap1", status: "EFFECTIVE",
    })

    await expect(rejectOwnershipSnapshot("snap1", "admin1")).rejects.toThrow(
      "Can only reject PROPOSED snapshots"
    )
  })
})

// ─── Test 13: Ownership adjustment ────
describe("Phase B: Ownership Adjustment", () => {
  it("Test 13: cannot adjust non-PROPOSED snapshot", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findUnique as any).mockResolvedValue({
      id: "snap1", status: "EFFECTIVE",
    })

    await expect(
      adjustOwnershipEntry("snap1", "participant1", "admin1", { ownershipPercentage: 50 })
    ).rejects.toThrow("Can only adjust PROPOSED snapshots")
  })
})

// ─── Test 14: Ownership proposal creates entries ────
describe("Phase B: Ownership Entries", () => {
  it("Test 14: proposeOwnershipSnapshot creates entries for each participant", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findFirst as any).mockResolvedValue(null)
    ;(mockPrisma.projectCapitalTransaction.findMany as any).mockResolvedValue([
      { participantId: "p1", ownershipEligibleAmount: 300000, participant: { userId: "u1", user: { name: "Alice" } }, id: "tx1" },
      { participantId: "p2", ownershipEligibleAmount: 700000, participant: { userId: "u2", user: { name: "Bob" } }, id: "tx2" },
    ])
    ;(mockPrisma.projectOwnershipSnapshot.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: "snap1", ...args.data })
    )
    ;(mockPrisma.projectOwnershipEntry.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: `entry-${args.data.participantId}`, ...args.data })
    )

    const snap = await proposeOwnershipSnapshot("proj1", "admin1", { note: "Initial" })

    expect(snap.totalCapital).toBe(1000000)
    // Two entries created
    expect(mockPrisma.projectOwnershipEntry.create).toHaveBeenCalledTimes(2)

    // First call should be for p1 (30%)
    const firstCall = (mockPrisma.projectOwnershipEntry.create as any).mock.calls[0][0]
    expect(firstCall.data.ownershipPercentage).toBeCloseTo(30, 0)

    // Second call for p2 (70%)
    const secondCall = (mockPrisma.projectOwnershipEntry.create as any).mock.calls[1][0]
    expect(secondCall.data.ownershipPercentage).toBeCloseTo(70, 0)
  })
})

// ─── Test 15: Ownership totals validate to 100% ────
describe("Phase B: Ownership Validation", () => {
  it("Test 15: approval rejects when ownership doesn't equal 100%", async () => {
    ;(mockPrisma.projectOwnershipSnapshot.findUnique as any).mockResolvedValue({
      id: "snap1", status: "PROPOSED", projectId: "proj1", version: 1,
      entries: [
        { ownershipPercentage: 45 },
        { ownershipPercentage: 45 },
      ],
    })

    await expect(approveOwnershipSnapshot("snap1", "admin1")).rejects.toThrow("Ownership must total 100%")
  })
})
