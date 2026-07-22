/**
 * Primary owner identity helpers.
 *
 * OWNER_EMAIL is the single source of truth for who is the primary owner.
 * Always compare through these helpers — never hardcode the email.
 */

import { normalizeEmail } from "./email"
import { prisma } from "./prisma"
import { ALL_CIRCLE_PERMISSIONS } from "./permissions/circlePermissions"
import type { CirclePermission } from "./permissions/circlePermissions"

/** Get the normalized OWNER_EMAIL from environment, or null. */
export function getPrimaryOwnerEmail(): string | null {
  return normalizeEmail(process.env.OWNER_EMAIL)
}

/** Check if a given email belongs to the primary owner (case-insensitive). */
export function isPrimaryOwnerEmail(email: string | null | undefined): boolean {
  const ownerEmail = getPrimaryOwnerEmail()
  if (!ownerEmail) return false
  return normalizeEmail(email) === ownerEmail
}

/** Check if a userId belongs to the primary owner (queries DB for email). */
let _ownerUserIdCache: { id: string; ts: number } | null = null

export async function isPrimaryOwnerUser(userId: string): Promise<boolean> {
  const ownerEmail = getPrimaryOwnerEmail()
  if (!ownerEmail) return false

  // Fast path: cache the primary owner userId for 5 minutes
  if (_ownerUserIdCache && _ownerUserIdCache.id === userId && Date.now() - _ownerUserIdCache.ts < 300_000) {
    return true
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user?.email) return false

  if (isPrimaryOwnerEmail(user.email)) {
    _ownerUserIdCache = { id: userId, ts: Date.now() }
    return true
  }
  return false
}

/** Primary owner gets ALL permissions in every circle. */
export function getPrimaryOwnerPermissions(): CirclePermission[] {
  return [...ALL_CIRCLE_PERMISSIONS]
}
