import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getPrimaryOwnerEmail, isPrimaryOwnerEmail } from "@/lib/owner-email"

describe("owner-email", () => {
  const originalEnv = process.env.OWNER_EMAIL

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OWNER_EMAIL = originalEnv
    } else {
      delete process.env.OWNER_EMAIL
    }
  })

  describe("getPrimaryOwnerEmail", () => {
    it("returns normalized email when set", () => {
      process.env.OWNER_EMAIL = "  Ademoyemo@Gmail.com  "
      expect(getPrimaryOwnerEmail()).toBe("ademoyemo@gmail.com")
    })

    it("returns null when not set", () => {
      delete process.env.OWNER_EMAIL
      expect(getPrimaryOwnerEmail()).toBeNull()
    })
  })

  describe("isPrimaryOwnerEmail", () => {
    it("returns true for matching email (case-insensitive)", () => {
      process.env.OWNER_EMAIL = "ademoyemo@gmail.com"
      expect(isPrimaryOwnerEmail("Ademoyemo@gmail.com")).toBe(true)
      expect(isPrimaryOwnerEmail("ADEMOYEMO@GMAIL.COM")).toBe(true)
      expect(isPrimaryOwnerEmail("ademoyemo@gmail.com")).toBe(true)
    })

    it("returns false for non-matching email", () => {
      process.env.OWNER_EMAIL = "ademoyemo@gmail.com"
      expect(isPrimaryOwnerEmail("other@gmail.com")).toBe(false)
    })

    it("returns false for null/undefined input", () => {
      process.env.OWNER_EMAIL = "ademoyemo@gmail.com"
      expect(isPrimaryOwnerEmail(null)).toBe(false)
      expect(isPrimaryOwnerEmail(undefined)).toBe(false)
    })

    it("returns false when OWNER_EMAIL is not set", () => {
      delete process.env.OWNER_EMAIL
      expect(isPrimaryOwnerEmail("ademoyemo@gmail.com")).toBe(false)
    })
  })
})
