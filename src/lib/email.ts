/**
 * Central email normalization utilities.
 * Use these everywhere emails are compared, stored, or displayed.
 */

/** Trim whitespace and lowercase. Returns null for null/undefined input. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  return email.trim().toLowerCase()
}

/** Case-insensitive email comparison. */
export function emailsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeEmail(a) === normalizeEmail(b)
}
