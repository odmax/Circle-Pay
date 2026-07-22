import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

// ─── Shortfall Engine ───────────────────────────────────────

export async function calculateRoundShortfalls(fundingRoundId: string) {
  const round = await prisma.projectFundingRound.findUnique({ where: { id: fundingRoundId } })
  if (!round) throw new Error("Funding round not found")

  const allocations = await prisma.projectFundingAllocation.findMany({
    where: { fundingRoundId },
    include: { participant: { include: { user: { select: { id: true, name: true } } } } },
  })

  const results = allocations.map((a) => {
    const allocated = Number(a.allocatedAmount)
    const paid = Number(a.paidAmount)
    const shortfall = Math.max(allocated - paid, 0)
    const excess = Math.max(paid - allocated, 0)
    return { ...a, computedShortfall: shortfall, computedExcess: excess, shortfallPercentage: allocated > 0 ? (shortfall / allocated) * 100 : 0 }
  })

  const totalAllocated = allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0)
  const totalPaid = allocations.reduce((s, a) => s + Number(a.paidAmount), 0)
  const roundShortfall = Math.max(totalAllocated - totalPaid, 0)

  return {
    allocations: results,
    summary: {
      totalAllocated, totalPaid, roundShortfall,
      participantsWithShortfall: results.filter((r) => r.computedShortfall > 0).length,
      participantsWithExcess: results.filter((r) => r.computedExcess > 0).length,
      fundingPercentage: totalAllocated > 0 ? (totalPaid / totalAllocated) * 100 : 0,
    },
  }
}

export async function openShortfallCoverRound(fundingRoundId: string, userId: string) {
  const round = await prisma.projectFundingRound.findUnique({ where: { id: fundingRoundId } })
  if (!round) throw new Error("Funding round not found")
  if (round.status !== "CLOSED" && round.status !== "CLOSING") {
    throw new Error("Funding round must be closed or closing to open shortfall cover")
  }

  await addProjectActivity(round.projectId, userId, "shortfall_cover_opened", `Shortfall cover round opened for "${round.name}"`, "Members can now offer coverage for shortfalls")
  return calculateRoundShortfalls(fundingRoundId)
}

export async function createShortfallCover(projectId: string, coveringParticipantId: string, data: {
  allocationId: string
  coveredParticipantId?: string
  amount: number
  type: "COVER_ADVANCE" | "OWNERSHIP_TRANSFER" | "PROJECT_ADVANCE" | "DONATION"
  repaymentDueDate?: Date
  interestRate?: number
  ownershipTransferRule?: string
}) {
  if (data.amount <= 0) throw new Error("Cover amount must be greater than zero")

  const allocation = await prisma.projectFundingAllocation.findUnique({ where: { id: data.allocationId } })
  if (!allocation) throw new Error("Allocation not found")

  const shortfall = Number(allocation.allocatedAmount) - Number(allocation.paidAmount)
  if (shortfall <= 0) throw new Error("This allocation has no shortfall")
  if (data.amount > shortfall) throw new Error(`Cover amount exceeds shortfall of R${shortfall}`)

  if (data.coveredParticipantId === coveringParticipantId) {
    throw new Error("Cannot cover your own shortfall through this mechanism")
  }

  const cover = await prisma.shortfallCover.create({
    data: {
      projectId, allocationId: data.allocationId, coveringParticipantId,
      coveredParticipantId: data.coveredParticipantId || null, amount: data.amount,
      type: data.type, repaymentDueDate: data.repaymentDueDate || null,
      interestRate: data.interestRate || null, ownershipTransferRule: data.ownershipTransferRule || null,
      status: "PENDING",
    },
  })

  await addProjectActivity(projectId, null, "shortfall_cover_created", `Shortfall cover of R${data.amount.toLocaleString()} offered`, `Type: ${data.type}`)
  return cover
}

export async function approveShortfallCover(coverId: string, adminId: string) {
  const cover = await prisma.shortfallCover.findUnique({ where: { id: coverId } })
  if (!cover) throw new Error("Shortfall cover not found")
  if (cover.status !== "PENDING") throw new Error("Cover is not pending")

  const updated = await prisma.shortfallCover.update({
    where: { id: coverId },
    data: { status: "CONFIRMED", approvedById: adminId, approvedAt: new Date() },
  })

  const allocation = await prisma.projectFundingAllocation.findUnique({ where: { id: cover.allocationId } })
  if (allocation) {
    const newPaid = Number(allocation.paidAmount) + Number(cover.amount)
    const allocated = Number(allocation.allocatedAmount)
    const newShortfall = Math.max(allocated - newPaid, 0)

    await prisma.projectFundingAllocation.update({
      where: { id: cover.allocationId },
      data: { paidAmount: newPaid, shortfallAmount: newShortfall, status: newShortfall === 0 ? "COVERED" : "SHORTFALL" },
    })
  }

  await addProjectActivity(cover.projectId, adminId, "shortfall_cover_approved", `Shortfall cover of R${Number(cover.amount).toLocaleString()} approved`, `Type: ${cover.type}`)
  return updated
}

export async function rejectShortfallCover(coverId: string, adminId: string, reason?: string) {
  const cover = await prisma.shortfallCover.findUnique({ where: { id: coverId } })
  if (!cover) throw new Error("Shortfall cover not found")
  if (cover.status !== "PENDING") throw new Error("Cover is not pending")
  return prisma.shortfallCover.update({ where: { id: coverId }, data: { status: "REJECTED", approvedById: adminId, approvedAt: new Date() } })
}

export async function settleShortfallCover(coverId: string) {
  const cover = await prisma.shortfallCover.findUnique({ where: { id: coverId } })
  if (!cover) throw new Error("Shortfall cover not found")
  if (cover.status !== "CONFIRMED") throw new Error("Cover must be confirmed")
  return prisma.shortfallCover.update({ where: { id: coverId }, data: { status: "SETTLED", settledAt: new Date() } })
}

export async function getProjectShortfallCovers(projectId: string) {
  const covers = await prisma.shortfallCover.findMany({
    where: { projectId },
    include: {
      allocation: { include: { participant: { include: { user: { select: { name: true } } } } } },
      coveringParticipant: { include: { user: { select: { id: true, name: true } } } },
      coveredParticipant: { include: { user: { select: { id: true, name: true } } } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const summary = {
    totalOffers: covers.length,
    pendingCovers: covers.filter((c) => c.status === "PENDING").reduce((s, c) => s + Number(c.amount), 0),
    confirmedCovers: covers.filter((c) => c.status === "CONFIRMED").reduce((s, c) => s + Number(c.amount), 0),
    settledCovers: covers.filter((c) => c.status === "SETTLED").reduce((s, c) => s + Number(c.amount), 0),
    byType: {
      COVER_ADVANCE: covers.filter((c) => c.type === "COVER_ADVANCE").reduce((s, c) => s + Number(c.amount), 0),
      OWNERSHIP_TRANSFER: covers.filter((c) => c.type === "OWNERSHIP_TRANSFER").reduce((s, c) => s + Number(c.amount), 0),
      PROJECT_ADVANCE: covers.filter((c) => c.type === "PROJECT_ADVANCE").reduce((s, c) => s + Number(c.amount), 0),
      DONATION: covers.filter((c) => c.type === "DONATION").reduce((s, c) => s + Number(c.amount), 0),
    },
  }

  return { covers, summary }
}
