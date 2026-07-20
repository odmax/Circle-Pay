/**
 * Primary owner identity helpers.
 *
 * OWNER_EMAIL is the single source of truth for who is the primary owner.
 * Always compare through these helpers — never hardcode the email.
 */

import { normalizeEmail } from "./email"

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
