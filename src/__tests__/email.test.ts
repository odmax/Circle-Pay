import { describe, it, expect } from "vitest"
import { normalizeEmail, emailsEqual } from "@/lib/email"

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com")
  })

  it("returns null for null/undefined", () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
  })

  it("treats empty string as falsy (returns null)", () => {
    expect(normalizeEmail("")).toBeNull()
  })

  it("normalizes Ademoyemo@gmail.com case variants", () => {
    expect(normalizeEmail("Ademoyemo@gmail.com")).toBe("ademoyemo@gmail.com")
    expect(normalizeEmail("ADEMOYEMO@GMAIL.COM")).toBe("ademoyemo@gmail.com")
    expect(normalizeEmail("ademoyemo@gmail.com")).toBe("ademoyemo@gmail.com")
  })
})

describe("emailsEqual", () => {
  it("compares case-insensitively", () => {
    expect(emailsEqual("User@Example.COM", "user@example.com")).toBe(true)
  })

  it("returns false for different emails", () => {
    expect(emailsEqual("a@b.com", "c@d.com")).toBe(false)
  })

  it("handles nulls", () => {
    expect(emailsEqual(null, null)).toBe(true)
    expect(emailsEqual(null, "a@b.com")).toBe(false)
    expect(emailsEqual("a@b.com", undefined)).toBe(false)
  })
})
