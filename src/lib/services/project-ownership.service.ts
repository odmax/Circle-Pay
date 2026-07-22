import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

// ─── Ownership Register ─────────────────────────────────────

/**
 * Calculate proposed ownership from confirmed capital transactions.
 * Does NOT auto-apply — creates a proposed snapshot for approval.
 */
export async function calculateProposedOwnership(projectId: string) {
  const capitalTxs = await prisma.projectCapitalTransaction.findMany({
    where: { projectId, status: "CONFIRMED" },
    include: { participant: { include: { user: { select: { id: true, name: true } } } } },
  })

  const participantCapital = new Map<string, { participantId: string; userId: string | null; name: string; capital: number; transactions: string[] }>()

  for (const tx of capitalTxs) {
    if (Number(tx.ownershipEligibleAmount) <= 0) continue

    const existing = participantCapital.get(tx.participantId) || {
      participantId: tx.participantId,
      userId: tx.participant.userId,
      name: tx.participant.user?.name || tx.participant.externalName || "Unknown",
      capital: 0,
      transactions: [],
    }
    existing.capital += Number(tx.ownershipEligibleAmount)
    existing.transactions.push(tx.id)
    participantCapital.set(tx.participantId, existing)
  }

  const totalCapital = Array.from(participantCapital.values()).reduce((s, p) => s + p.capital, 0)

  const entries = Array.from(participantCapital.values()).map((p) => ({
    participantId: p.participantId,
    userId: p.userId,
    name: p.name,
    capitalContributed: p.capital,
    ownershipPercentage: totalCapital > 0 ? (p.capital / totalCapital) * 100 : 0,
    profitSharePercentage: totalCapital > 0 ? (p.capital / totalCapital) * 100 : 0,
    votingPercentage: totalCapital > 0 ? (p.capital / totalCapital) * 100 : 0,
    sourceTransactions: p.transactions,
  }))

  return { entries, totalCapital }
}

/**
 * Propose an ownership snapshot from current capital contributions.
 * Creates a PROPOSED snapshot with entries for approval.
 */
export async function proposeOwnershipSnapshot(projectId: string, userId: string, data?: { note?: string }) {
  const existingActive = await prisma.projectOwnershipSnapshot.findFirst({
    where: { projectId, status: { in: ["PROPOSED", "EFFECTIVE"] } },
  })
  if (existingActive && existingActive.status === "PROPOSED") {
    throw new Error("A proposed snapshot already exists — approve or reject it first")
  }

  const { entries, totalCapital } = await calculateProposedOwnership(projectId)
  if (entries.length === 0) throw new Error("No eligible capital contributions to base ownership on")

  const nextVersion = (existingActive?.version || 0) + 1

  const snapshot = await prisma.projectOwnershipSnapshot.create({
    data: {
      projectId,
      version: nextVersion,
      totalCapital,
      status: "PROPOSED",
      proposalNote: data?.note || null,
    },
  })

  for (const entry of entries) {
    await prisma.projectOwnershipEntry.create({
      data: {
        snapshotId: snapshot.id,
        projectId,
        participantId: entry.participantId,
        capitalContributed: entry.capitalContributed,
        ownershipPercentage: entry.ownershipPercentage,
        profitSharePercentage: entry.profitSharePercentage,
        votingPercentage: entry.votingPercentage,
        sourceTransactions: JSON.stringify(entry.sourceTransactions),
      },
    })
  }

  await addProjectActivity(projectId, userId, "ownership_proposed", `Ownership snapshot v${nextVersion} proposed`, `Total capital: R${totalCapital.toLocaleString()}, ${entries.length} participants`)
  return snapshot
}

/**
 * Approve a proposed ownership snapshot.
 * Previous effective snapshot is superseded.
 */
export async function approveOwnershipSnapshot(snapshotId: string, userId: string) {
  const snapshot = await prisma.projectOwnershipSnapshot.findUnique({
    where: { id: snapshotId },
    include: { entries: true },
  })
  if (!snapshot) throw new Error("Snapshot not found")
  if (snapshot.status !== "PROPOSED") throw new Error("Can only approve PROPOSED snapshots")

  // Validate ownership totals
  const totalOwnership = snapshot.entries.reduce((s, e) => s + Number(e.ownershipPercentage), 0)
  if (Math.abs(totalOwnership - 100) > 0.01) {
    throw new Error(`Ownership must total 100% (currently ${totalOwnership.toFixed(2)}%)`)
  }

  // Supersede any previous effective snapshot
  await prisma.projectOwnershipSnapshot.updateMany({
    where: { projectId: snapshot.projectId, status: "EFFECTIVE", id: { not: snapshotId } },
    data: { status: "SUPERSEDED", supersededAt: new Date(), supersededById: userId },
  })

  const updated = await prisma.projectOwnershipSnapshot.update({
    where: { id: snapshotId },
    data: { status: "EFFECTIVE", approvedById: userId, approvedAt: new Date(), effectiveDate: new Date() },
  })

  await addProjectActivity(snapshot.projectId, userId, "ownership_approved", `Ownership snapshot v${snapshot.version} approved`, `Effective from ${new Date().toLocaleDateString()}`)
  return updated
}

/**
 * Reject a proposed ownership snapshot.
 */
export async function rejectOwnershipSnapshot(snapshotId: string, userId: string, reason?: string) {
  const snapshot = await prisma.projectOwnershipSnapshot.findUnique({ where: { id: snapshotId } })
  if (!snapshot) throw new Error("Snapshot not found")
  if (snapshot.status !== "PROPOSED") throw new Error("Can only reject PROPOSED snapshots")

  const updated = await prisma.projectOwnershipSnapshot.update({
    where: { id: snapshotId },
    data: { status: "REJECTED", metadata: { rejectionReason: reason || null } },
  })

  await addProjectActivity(snapshot.projectId, userId, "ownership_rejected", `Ownership snapshot v${snapshot.version} rejected`, reason || "")
  return updated
}

/**
 * Get the current effective ownership snapshot with entries.
 */
export async function getEffectiveOwnership(projectId: string) {
  const snapshot = await prisma.projectOwnershipSnapshot.findFirst({
    where: { projectId, status: "EFFECTIVE" },
    include: {
      entries: {
        include: { participant: { include: { user: { select: { id: true, name: true, email: true } } } } },
        orderBy: { ownershipPercentage: "desc" },
      },
    },
  })
  return snapshot
}

/**
 * Get all ownership snapshots for a project.
 */
export async function getOwnershipHistory(projectId: string) {
  const snapshots = await prisma.projectOwnershipSnapshot.findMany({
    where: { projectId },
    include: {
      entries: {
        include: { participant: { include: { user: { select: { id: true, name: true } } } } },
      },
      approvedBy: { select: { name: true } },
    },
    orderBy: { version: "desc" },
  })

  const latestProposed = snapshots.find((s) => s.status === "PROPOSED")
  const effective = snapshots.find((s) => s.status === "EFFECTIVE")

  return {
    snapshots,
    effective,
    latestProposed,
    totalSnapshots: snapshots.length,
  }
}

/**
 * Manually adjust a participant's entry in a proposed snapshot.
 * Only works on PROPOSED snapshots.
 */
export async function adjustOwnershipEntry(snapshotId: string, participantId: string, userId: string, data: {
  ownershipPercentage?: number
  profitSharePercentage?: number
  votingPercentage?: number
  notes?: string
}) {
  const snapshot = await prisma.projectOwnershipSnapshot.findUnique({ where: { id: snapshotId } })
  if (!snapshot) throw new Error("Snapshot not found")
  if (snapshot.status !== "PROPOSED") throw new Error("Can only adjust PROPOSED snapshots")

  const entry = await prisma.projectOwnershipEntry.findUnique({
    where: { snapshotId_participantId: { snapshotId, participantId } },
  })
  if (!entry) throw new Error("Entry not found in this snapshot")

  const safe: Record<string, unknown> = {}
  if (data.ownershipPercentage !== undefined) safe.ownershipPercentage = data.ownershipPercentage
  if (data.profitSharePercentage !== undefined) safe.profitSharePercentage = data.profitSharePercentage
  if (data.votingPercentage !== undefined) safe.votingPercentage = data.votingPercentage
  if (data.notes !== undefined) safe.notes = data.notes

  const updated = await prisma.projectOwnershipEntry.update({
    where: { snapshotId_participantId: { snapshotId, participantId } },
    data: safe as any,
  })

  // Recalculate total ownership after adjustment
  const allEntries = await prisma.projectOwnershipEntry.findMany({ where: { snapshotId } })
  const totalOwnership = allEntries.reduce((s, e) => s + Number(e.ownershipPercentage), 0)

  await addProjectActivity(snapshot.projectId, userId, "ownership_adjusted", `Ownership entry adjusted for participant`, `New total: ${totalOwnership.toFixed(2)}%`)
  return updated
}
