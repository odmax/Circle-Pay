import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

// ─── Waterfall Tier Types ───────────────────────────────────
// PREFERRED_RETURN: fixed rate return on capital (e.g. 8% annual)
// CAPITAL_RETURN: return of principal before profit split
// PROFIT_SPLIT: percentage split between LP/GP or participants
// CATCH_UP: GP catch-up tier (e.g. GP gets 20% until 20/80 split)
// RESERVE: retained amount before distribution

export interface WaterfallTier {
  name: string
  type: "PREFERRED_RETURN" | "CAPITAL_RETURN" | "PROFIT_SPLIT" | "CATCH_UP" | "RESERVE"
  rate?: number          // for PREFERRED_RETURN: annual rate (e.g. 0.08 = 8%)
  lpPercent?: number     // for PROFIT_SPLIT: LP share (e.g. 0.80)
  gpPercent?: number     // for PROFIT_SPLIT: GP share (e.g. 0.20)
  reservePercent?: number // for RESERVE: % of profit to retain
  cap?: number           // optional cap on this tier's payout
  priority: number       // execution order (1 = first)
}

// ─── Config Management ──────────────────────────────────────

export async function getWaterfallConfig(projectId: string) {
  return prisma.projectWaterfallConfig.findUnique({ where: { projectId } })
}

export async function upsertWaterfallConfig(projectId: string, userId: string, data: {
  enabled: boolean
  tiers: WaterfallTier[]
}) {
  // Validate tiers are ordered by priority
  const sorted = [...data.tiers].sort((a, b) => a.priority - b.priority)
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].priority !== i + 1) {
      throw new Error(`Waterfall tiers must have sequential priority starting from 1. Tier "${sorted[i].name}" has priority ${sorted[i].priority}`)
    }
  }

  // Validate PROFIT_SPLIT tiers have LP+GP = 100%
  for (const tier of sorted) {
    if (tier.type === "PROFIT_SPLIT") {
      const total = (tier.lpPercent || 0) + (tier.gpPercent || 0)
      if (Math.abs(total - 1) > 0.001) {
        throw new Error(`Profit split tier "${tier.name}" must have LP + GP = 100% (currently ${Math.round(total * 100)}%)`)
      }
    }
    if (tier.type === "PREFERRED_RETURN" && (!tier.rate || tier.rate <= 0)) {
      throw new Error(`Preferred return tier "${tier.name}" must have a positive rate`)
    }
    if (tier.type === "RESERVE" && (!tier.reservePercent || tier.reservePercent <= 0 || tier.reservePercent >= 1)) {
      throw new Error(`Reserve tier "${tier.name}" must have reservePercent between 0 and 1`)
    }
  }

  const config = await prisma.projectWaterfallConfig.upsert({
    where: { projectId },
    update: { enabled: data.enabled, tiers: sorted as any },
    create: { projectId, enabled: data.enabled, tiers: sorted as any },
  })

  await addProjectActivity(projectId, userId, "waterfall_config_updated", `Waterfall config ${data.enabled ? "enabled" : "disabled"} with ${sorted.length} tiers`)
  return config
}

// ─── Waterfall Calculation Engine ───────────────────────────

export interface WaterfallResult {
  tierResults: {
    name: string
    type: string
    amount: number
    description: string
  }[]
  totalDistributed: number
  totalReserved: number
  distributableProfit: number
  remainingProfit: number
}

/**
 * Apply the waterfall distribution to a distributable profit amount.
 * Returns per-tier breakdown and final distributable amount.
 */
export async function calculateWaterfallDistribution(
  projectId: string,
  distributableProfit: number,
  totalCapital: number,
) {
  const config = await prisma.projectWaterfallConfig.findUnique({ where: { projectId } })
  if (!config || !config.enabled) {
    return {
      tierResults: [],
      totalDistributed: 0,
      totalReserved: 0,
      distributableProfit,
      remainingProfit: distributableProfit,
    }
  }

  const tiers = (config.tiers as unknown as WaterfallTier[]).sort((a, b) => a.priority - b.priority)
  let remaining = distributableProfit
  const tierResults: WaterfallResult["tierResults"] = []
  let totalDistributed = 0
  let totalReserved = 0
  const capitalReturned = Number(config.capitalReturned || 0)

  for (const tier of tiers) {
    if (remaining <= 0) break

    let tierAmount = 0
    let description = ""

    switch (tier.type) {
      case "PREFERRED_RETURN": {
        const rate = tier.rate || 0
        const accrued = Number(config.preferredReturnAccrued || 0)
        const target = totalCapital * rate
        const owed = Math.max(0, target - accrued)
        tierAmount = Math.min(remaining, owed)
        description = `Preferred return: ${Math.round(rate * 100)}% on R${totalCapital.toLocaleString()} = R${owed.toLocaleString()} owed, paying R${tierAmount.toLocaleString()}`
        break
      }

      case "CAPITAL_RETURN": {
        const remainingCapital = Math.max(0, totalCapital - capitalReturned)
        tierAmount = Math.min(remaining, remainingCapital)
        description = `Capital return: R${remainingCapital.toLocaleString()} remaining principal`
        break
      }

      case "PROFIT_SPLIT": {
        const lpPercent = tier.lpPercent || 0.8
        tierAmount = remaining * lpPercent
        description = `Profit split: LP ${Math.round(lpPercent * 100)}% = R${tierAmount.toLocaleString()}`
        break
      }

      case "CATCH_UP": {
        // Simplified catch-up: distribute until GP has caught up to target ratio
        const gpTarget = tier.gpPercent || 0.2
        const catchUpAmount = remaining * gpTarget * 4 // approximate catch-up
        tierAmount = Math.min(remaining, catchUpAmount)
        description = `GP catch-up: R${tierAmount.toLocaleString()}`
        break
      }

      case "RESERVE": {
        const reservePct = tier.reservePercent || 0.1
        tierAmount = remaining * reservePct
        totalReserved += tierAmount
        description = `Reserve: ${Math.round(reservePct * 100)}% = R${tierAmount.toLocaleString()} retained`
        break
      }
    }

    tierAmount = Math.round(tierAmount * 100) / 100
    if (tierAmount > 0) {
      remaining -= tierAmount
      if (tier.type === "RESERVE") {
        // Reserved amounts stay in remaining for further tiers
      } else {
        totalDistributed += tierAmount
      }
      tierResults.push({ name: tier.name, type: tier.type, amount: tierAmount, description })
    }
  }

  return {
    tierResults,
    totalDistributed,
    totalReserved,
    distributableProfit,
    remainingProfit: Math.round(remaining * 100) / 100,
  }
}

// ─── Waterfall-Aware Distribution ───────────────────────────

export async function createWaterfallDistribution(
  projectId: string,
  circleId: string,
  userId: string,
  data: { name: string; distributionPeriodId?: string }
) {
  const config = await prisma.projectWaterfallConfig.findUnique({ where: { projectId } })
  if (!config || !config.enabled) throw new Error("Waterfall not configured for this project")

  const { getProjectROIDashboard } = await import("@/lib/services/project-roi.service")
  const roi = await getProjectROIDashboard(projectId)
  const distributableProfit = (roi.summary as any).netProfit || 0
  if (distributableProfit <= 0) throw new Error("No distributable profit")

  const effectiveOwnership = await prisma.projectOwnershipSnapshot.findFirst({
    where: { projectId, status: "EFFECTIVE" },
    include: { entries: true },
  })

  const totalCapital = effectiveOwnership ? Number(effectiveOwnership.totalCapital) : Number(config.preferredReturnAccrued || 0)
  if (totalCapital <= 0) throw new Error("No capital base for waterfall calculation")

  const waterfall = await calculateWaterfallDistribution(projectId, distributableProfit, totalCapital)
  if (waterfall.totalDistributed <= 0) throw new Error("Waterfall produces no distributable amount")

  const items: { projectId: string; userId: string; contributionAmount: number; ownershipPercentage: number; profitShare: number; metadata?: any }[] = []

  if (effectiveOwnership?.entries.length) {
    for (const entry of effectiveOwnership.entries) {
      const ownershipPct = Number(entry.ownershipPercentage)
      const profitShare = Math.round(waterfall.totalDistributed * (ownershipPct / 100) * 100) / 100
      items.push({
        projectId,
        userId: entry.participantId, // participantId used as userId proxy
        contributionAmount: Number(entry.capitalContributed),
        ownershipPercentage: ownershipPct,
        profitShare,
        metadata: { waterfallApplied: true, tierBreakdown: waterfall.tierResults },
      })
    }
  } else {
    // Fallback: equal split
    const { calculateProjectOwnership } = await import("@/lib/services/project-distribution.service")
    const ownership = await calculateProjectOwnership(projectId)
    for (const owner of ownership.owners) {
      const share = Math.round(waterfall.totalDistributed * (owner.ownership / 100) * 100) / 100
      items.push({
        projectId, userId: owner.id, contributionAmount: owner.contribution,
        ownershipPercentage: owner.ownership, profitShare: share,
        metadata: { waterfallApplied: true, tierBreakdown: waterfall.tierResults },
      })
    }
  }

  const dist = await prisma.projectDistribution.create({
    data: {
      projectId, circleId, createdById: userId, name: data.name,
      method: "WATERFALL",
      totalProfit: waterfall.totalDistributed,
      metadata: { waterfall: waterfall.tierResults, reserved: waterfall.totalReserved } as any,
      items: { create: items },
    },
    include: { items: true },
  })

  // Update waterfall config accruals
  for (const tier of waterfall.tierResults) {
    if (tier.type === "PREFERRED_RETURN") {
      await prisma.projectWaterfallConfig.update({
        where: { projectId },
        data: { preferredReturnAccrued: { increment: tier.amount } },
      })
    }
    if (tier.type === "CAPITAL_RETURN") {
      await prisma.projectWaterfallConfig.update({
        where: { projectId },
        data: { capitalReturned: { increment: tier.amount } },
      })
    }
  }

  // Link to distribution period if provided
  if (data.distributionPeriodId) {
    await prisma.projectDistributionPeriod.update({
      where: { id: data.distributionPeriodId },
      data: { distributionId: dist.id, status: "DISTRIBUTED", distributedAmount: waterfall.totalDistributed },
    })
  }

  await addProjectActivity(projectId, userId, "waterfall_distribution_created",
    `Waterfall distribution "${data.name}" — R${waterfall.totalDistributed.toLocaleString()}`,
    `${waterfall.tierResults.length} tiers applied, R${waterfall.totalReserved.toLocaleString()} reserved`
  )

  return { distribution: dist, waterfall }
}
