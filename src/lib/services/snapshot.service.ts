import { prisma } from "@/lib/prisma"

/* eslint-disable @typescript-eslint/no-explicit-any */
// Snapshot service uses dynamic Prisma model access for generic caching

// ═══════════════════════════════════════════════════════════
// GENERIC SNAPSHOT HELPERS
// ═══════════════════════════════════════════════════════════

export async function getSnapshot<T>(
  model: "dashboardSnapshot" | "circleSnapshot" | "ownerSnapshot",
  where: Record<string, string>
): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap = await (prisma as any)[model].findUnique({ where })
  if (snap && !snap.stale) return snap.data as T
  return null
}

export async function refreshSnapshot<T>(
  model: "dashboardSnapshot" | "circleSnapshot" | "ownerSnapshot",
  where: Record<string, string>,
  data: T
): Promise<T> {
  await (prisma as any)[model].upsert({
    where,
    create: { ...where, data, stale: false },
    update: { data, stale: false },
  })
  return data
}

export async function markSnapshotStale(
  model: "dashboardSnapshot" | "circleSnapshot" | "ownerSnapshot",
  where: Record<string, unknown>
) {
  try { await (prisma as any)[model].updateMany({ where, data: { stale: true } }) } catch {}
}

// ═══════════════════════════════════════════════════════════
// SPECIFIC SNAPSHOT HELPERS
// ═══════════════════════════════════════════════════════════

export async function getDashboardSnapshot(userId: string) {
  const snap = await (prisma as any).dashboardSnapshot.findUnique({ where: { userId } })
  if (!snap) return null

  const stale = snap.stale || (Date.now() - new Date(snap.updatedAt).getTime() > 60000)

  // Return cached data even if stale — refresh happens in background
  const data = snap.data

  // Trigger background refresh if stale
  if (stale) {
    const { getUserDashboard } = await import("./dashboard.service")
    getUserDashboard(userId).then((fresh) => {
      refreshSnapshot("dashboardSnapshot", { userId }, fresh).catch(console.error)
    }).catch(console.error)
  }

  return data
}

export async function refreshDashboardSnapshot(userId: string, data: unknown) {
  return refreshSnapshot("dashboardSnapshot", { userId }, data)
}

export async function markDashboardStale(userId: string) {
  return markSnapshotStale("dashboardSnapshot", { userId })
}

export async function getCircleSnapshot(circleId: string) {
  return getSnapshot<any>("circleSnapshot", { circleId })
}

export async function refreshCircleSnapshot(circleId: string, data: unknown) {
  return refreshSnapshot("circleSnapshot", { circleId }, data)
}

export async function markCircleStale(circleId: string) {
  return markSnapshotStale("circleSnapshot", { circleId })
}

export async function getOwnerSnapshot(key: string) {
  return getSnapshot<any>("ownerSnapshot", { key })
}

export async function refreshOwnerSnapshot(key: string, data: unknown) {
  return refreshSnapshot("ownerSnapshot", { key }, data)
}

export async function markOwnerStale(key: string) {
  return markSnapshotStale("ownerSnapshot", { key })
}
