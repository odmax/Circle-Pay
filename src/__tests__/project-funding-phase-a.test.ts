import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectFundingRound: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    projectFundingAllocation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    projectFundingCommitment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    projectCapitalTransaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    projectParticipant: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    circleMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    shortfallCover: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/services/project.service", () => ({
  addProjectActivity: vi.fn().mockResolvedValue({}),
  requireProjectInCircle: vi.fn().mockResolvedValue({ id: "proj1", circleId: "circle1" }),
}))

vi.mock("@/lib/services/wallet.service", () => ({
  recordContributionToLedger: vi.fn().mockResolvedValue({}),
}))

import { prisma } from "@/lib/prisma"
import {
  createFundingRound,
  generateEqualAllocations,
  adjustAllocation,
  createCommitment,
  approveCommitment,
  cancelCommitment,
  transitionFundingRound,
  getProjectFundingOverview,
  addExternalParticipant,
} from "@/lib/services/project-funding.service"
import {
  recordCapitalTransaction,
  confirmCapitalTransaction,
  rejectCapitalTransaction,
} from "@/lib/services/project-capital.service"
import {
  createShortfallCover,
  approveShortfallCover,
  calculateRoundShortfalls,
} from "@/lib/services/project-shortfall.service"

const mockPrisma = vi.mocked(prisma)

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Test 1: Equal allocation for ₦5,000,000 project ────
describe("Phase A: Equal Allocation", () => {
  it("Test 1: generates equal allocations for ₦5,000,000 among 10 members", async () => {
    const round = {
      id: "round1", projectId: "proj1", targetAmount: 5000000, status: "DRAFT",
      dueDate: null, project: { id: "proj1", circleId: "circle1" },
    }
    ;(mockPrisma.projectFundingRound.findUnique as any).mockResolvedValue(round)
    ;(mockPrisma.circleMember.findMany as any).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ userId: `user${i}`, user: { id: `user${i}` } }))
    )
    ;(mockPrisma.projectFundingAllocation.deleteMany as any).mockResolvedValue({ count: 0 })
    ;(mockPrisma.projectParticipant.findFirst as any).mockResolvedValue(null)
    ;(mockPrisma.projectParticipant.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: `participant-${args.data.userId}`, ...args.data })
    )
    ;(mockPrisma.projectFundingAllocation.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: `alloc-${Math.random()}`, ...args.data })
    )

    const allocations = await generateEqualAllocations("round1", "admin1")

    expect(allocations).toHaveLength(10)
    const amounts = allocations.map((a) => Number(a.allocatedAmount))
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(5000000)
    // Each should be 500000 except the last gets remainder
    expect(Number(allocations[0].allocatedAmount)).toBe(500000)
  })
})

// ─── Test 2: Decimal rounding with uneven member counts ───
describe("Phase A: Rounding", () => {
  it("Test 2: handles rounding correctly with 3 members and ₦1,000,000", async () => {
    const round = {
      id: "round2", projectId: "proj1", targetAmount: 1000000, status: "DRAFT",
      dueDate: null, project: { id: "proj1", circleId: "circle1" },
    }
    ;(mockPrisma.projectFundingRound.findUnique as any).mockResolvedValue(round)
    ;(mockPrisma.circleMember.findMany as any).mockResolvedValue([
      { userId: "u1", user: { id: "u1" } },
      { userId: "u2", user: { id: "u2" } },
      { userId: "u3", user: { id: "u3" } },
    ])
    ;(mockPrisma.projectFundingAllocation.deleteMany as any).mockResolvedValue({ count: 0 })
    ;(mockPrisma.projectParticipant.findFirst as any).mockResolvedValue(null)
    ;(mockPrisma.projectParticipant.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: `p-${args.data.userId}`, ...args.data })
    )
    ;(mockPrisma.projectFundingAllocation.create as any).mockImplementation((args: any) =>
      Promise.resolve({ id: `alloc-${Math.random()}`, ...args.data })
    )

    const allocations = await generateEqualAllocations("round2", "admin1")

    expect(allocations).toHaveLength(3)
    const amounts = allocations.map((a) => Number(a.allocatedAmount))
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(1000000)
    // 1000000 / 3 = 333333.33, last gets remainder
    expect(Number(allocations[0].allocatedAmount)).toBeCloseTo(333333.33, 2)
    expect(Number(allocations[1].allocatedAmount)).toBeCloseTo(333333.33, 2)
    expect(Number(allocations[2].allocatedAmount)).toBeCloseTo(333333.34, 2)
  })
})

// ─── Test 3: Allocation adjustment ────
describe("Phase A: Allocation Adjustment", () => {
  it("Test 3: adjustAllocation requires a reason", async () => {
    ;(mockPrisma.projectFundingAllocation.findUnique as any).mockResolvedValue({
      id: "alloc1", status: "PENDING",
    })

    await expect(
      adjustAllocation("alloc1", "admin1", { allocatedAmount: 100000, reason: "" })
    ).rejects.toThrow("Adjustment reason is required")
  })
})

// ─── Test 4: Funding round lifecycle ────
describe("Phase A: Funding Round Lifecycle", () => {
  it("Test 4: cannot transition from DRAFT to CLOSED directly", async () => {
    ;(mockPrisma.projectFundingRound.findUnique as any).mockResolvedValue({
      id: "round1", status: "DRAFT", project: { id: "proj1" },
    })

    await expect(transitionFundingRound("round1", "CLOSED", "admin1")).rejects.toThrow(
      "Cannot transition funding round from DRAFT to CLOSED"
    )
  })

  it("Test 5: valid transition from DRAFT to OPEN", async () => {
    ;(mockPrisma.projectFundingRound.findUnique as any).mockResolvedValue({
      id: "round1", status: "DRAFT", project: { id: "proj1" },
    })
    ;(mockPrisma.projectFundingRound.update as any).mockResolvedValue({ id: "round1", status: "OPEN" })
    ;(mockPrisma.project.update as any).mockResolvedValue({})

    const result = await transitionFundingRound("round1", "OPEN", "admin1")
    expect(result.status).toBe("OPEN")
  })
})

// ─── Test 6: Funding round creation validation ────
describe("Phase A: Funding Round Creation", () => {
  it("Test 6: rejects zero target amount", async () => {
    await expect(
      createFundingRound("proj1", "admin1", { name: "Round 1", targetAmount: 0 })
    ).rejects.toThrow("Target amount must be greater than zero")
  })

  it("Test 7: rejects min > max contribution", async () => {
    await expect(
      createFundingRound("proj1", "admin1", {
        name: "Round 1", targetAmount: 1000000,
        minimumContribution: 50000, maximumContribution: 10000,
      })
    ).rejects.toThrow("Minimum contribution cannot exceed maximum")
  })
})

// ─── Test 8: Commitment creation ────
describe("Phase A: Commitments", () => {
  it("Test 8: rejects zero amount commitment", async () => {
    await expect(
      createCommitment("round1", "participant1", { amount: 0 })
    ).rejects.toThrow("Commitment amount must be greater than zero")
  })
})

// ─── Test 9: Capital transaction validation ────
describe("Phase A: Capital Transactions", () => {
  it("Test 9: rejects zero amount capital transaction", async () => {
    await expect(
      recordCapitalTransaction("proj1", "participant1", { amount: 0 })
    ).rejects.toThrow("Amount must be greater than zero")
  })

  it("Test 10: confirmCapitalTransaction requires SUBMITTED status", async () => {
    ;(mockPrisma.projectCapitalTransaction.findUnique as any).mockResolvedValue({
      id: "tx1", status: "PENDING",
    })

    await expect(confirmCapitalTransaction("tx1", "admin1")).rejects.toThrow(
      "Transaction must be submitted"
    )
  })

  it("Test 11: rejectCapitalTransaction requires SUBMITTED status", async () => {
    ;(mockPrisma.projectCapitalTransaction.findUnique as any).mockResolvedValue({
      id: "tx1", status: "CONFIRMED",
    })

    await expect(rejectCapitalTransaction("tx1", "admin1")).rejects.toThrow(
      "Transaction must be submitted"
    )
  })
})

// ─── Test 12: Shortfall cover validation ────
describe("Phase A: Shortfall Cover", () => {
  it("Test 12: rejects cover when allocation has no shortfall", async () => {
    ;(mockPrisma.projectFundingAllocation.findUnique as any).mockResolvedValue({
      id: "alloc1", allocatedAmount: 100000, paidAmount: 100000,
    })

    await expect(
      createShortfallCover("proj1", "participant1", {
        allocationId: "alloc1", amount: 50000, type: "COVER_ADVANCE",
      })
    ).rejects.toThrow("This allocation has no shortfall")
  })

  it("Test 13: rejects self-cover", async () => {
    ;(mockPrisma.projectFundingAllocation.findUnique as any).mockResolvedValue({
      id: "alloc1", allocatedAmount: 100000, paidAmount: 50000,
    })

    await expect(
      createShortfallCover("proj1", "participant1", {
        allocationId: "alloc1", coveredParticipantId: "participant1",
        amount: 50000, type: "COVER_ADVANCE",
      })
    ).rejects.toThrow("Cannot cover your own shortfall through this mechanism")
  })

  it("Test 14: rejects cover amount exceeding shortfall", async () => {
    ;(mockPrisma.projectFundingAllocation.findUnique as any).mockResolvedValue({
      id: "alloc1", allocatedAmount: 100000, paidAmount: 80000,
    })

    await expect(
      createShortfallCover("proj1", "participant1", {
        allocationId: "alloc1", amount: 30000, type: "COVER_ADVANCE",
      })
    ).rejects.toThrow("Cover amount exceeds shortfall of")
  })
})

// ─── Test 15: External participant creation ────
describe("Phase A: External Participants", () => {
  it("Test 15: rejects participant without name", async () => {
    await expect(
      addExternalParticipant("proj1", { name: "", type: "EXTERNAL_INVESTOR" })
    ).rejects.toThrow("Participant name is required")
  })
})

// ─── Test 16: getProjectFundingOverview summary ────
describe("Phase A: Funding Overview", () => {
  it("Test 16: returns correct summary structure", async () => {
    ;(mockPrisma.projectFundingRound.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectFundingAllocation.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectFundingCommitment.findMany as any).mockResolvedValue([])
    ;(mockPrisma.projectCapitalTransaction.findMany as any).mockResolvedValue([])

    const overview = await getProjectFundingOverview("proj1")

    expect(overview.summary).toHaveProperty("totalTarget")
    expect(overview.summary).toHaveProperty("totalAllocated")
    expect(overview.summary).toHaveProperty("totalPaid")
    expect(overview.summary).toHaveProperty("totalShortfall")
    expect(overview.summary).toHaveProperty("fundingPercentage")
    expect(overview.summary).toHaveProperty("confirmedCapital")
    expect(overview.rounds).toEqual([])
    expect(overview.allocations).toEqual([])
  })
})
