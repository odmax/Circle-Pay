import { describe, it, expect, vi, beforeEach } from "vitest"
import crypto from "crypto"

vi.mock("@/lib/prisma", () => {
  const mock = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((fns: any[]) => Promise.all(fns)),
  }
  return { prisma: mock }
})

vi.mock("@/lib/services/email.service", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}

describe("forgotPasswordSchema", () => {
  it("accepts valid email", async () => {
    const { forgotPasswordSchema } = await import("@/lib/validations/password-reset")
    expect(forgotPasswordSchema.safeParse({ email: "test@example.com" }).success).toBe(true)
  })

  it("rejects invalid email", async () => {
    const { forgotPasswordSchema } = await import("@/lib/validations/password-reset")
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false)
  })
})

describe("resetPasswordSchema", () => {
  it("accepts matching passwords meeting policy", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "Strong1Pass",
      confirmPassword: "Strong1Pass",
    })
    expect(result.success).toBe(true)
  })

  it("rejects short password", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "Ab1",
      confirmPassword: "Ab1",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing uppercase", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "strong1pass",
      confirmPassword: "strong1pass",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing lowercase", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "STRONG1PASS",
      confirmPassword: "STRONG1PASS",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing number", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "StrongPass",
      confirmPassword: "StrongPass",
    })
    expect(result.success).toBe(false)
  })

  it("rejects mismatched passwords", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "Strong1Pass",
      confirmPassword: "Different1Pass",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty token", async () => {
    const { resetPasswordSchema } = await import("@/lib/validations/password-reset")
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "Strong1Pass",
      confirmPassword: "Strong1Pass",
    })
    expect(result.success).toBe(false)
  })
})

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns success for non-existent email (no leak)", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const { requestPasswordReset } = await import("@/lib/services/password-reset.service")
    const result = await requestPasswordReset("nobody@example.com")
    expect(result.success).toBe(true)
    expect(prisma.user.findUnique).toHaveBeenCalled()
  })

  it("creates token and sends email for existing user", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", email: "test@example.com" } as any)
    vi.mocked(prisma.passwordResetToken.count).mockResolvedValue(0)
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({} as any)
    const { sendPasswordResetEmail } = await import("@/lib/services/email.service")

    const { requestPasswordReset } = await import("@/lib/services/password-reset.service")
    const result = await requestPasswordReset("test@example.com")
    expect(result.success).toBe(true)
    expect(prisma.passwordResetToken.create).toHaveBeenCalled()
    expect(sendPasswordResetEmail).toHaveBeenCalled()
  })

  it("rate-limits after 5 requests per hour", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", email: "test@example.com" } as any)
    vi.mocked(prisma.passwordResetToken.count).mockResolvedValue(5)

    const { requestPasswordReset } = await import("@/lib/services/password-reset.service")
    const result = await requestPasswordReset("test@example.com")
    expect(result.success).toBe(true)
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
  })
})

describe("verifyResetToken", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects non-existent token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null)

    const { verifyResetToken } = await import("@/lib/services/password-reset.service")
    const result = await verifyResetToken("bad-token")
    expect(result.valid).toBe(false)
    expect(result.error).toBe("Invalid reset link.")
  })

  it("rejects already-used token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    } as any)

    const { verifyResetToken } = await import("@/lib/services/password-reset.service")
    const result = await verifyResetToken("used-token")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("already been used")
  })

  it("rejects expired token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 60000),
    } as any)

    const { verifyResetToken } = await import("@/lib/services/password-reset.service")
    const result = await verifyResetToken("expired-token")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("expired")
  })

  it("accepts valid unused token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    } as any)

    const { verifyResetToken } = await import("@/lib/services/password-reset.service")
    const result = await verifyResetToken("valid-token")
    expect(result.valid).toBe(true)
  })
})

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects invalid token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null)

    const { resetPassword } = await import("@/lib/services/password-reset.service")
    const result = await resetPassword("bad-token", "NewPass1")
    expect(result.success).toBe(false)
    expect(result.error).toContain("Invalid")
  })

  it("rejects used token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    } as any)

    const { resetPassword } = await import("@/lib/services/password-reset.service")
    const result = await resetPassword("used-token", "NewPass1")
    expect(result.success).toBe(false)
    expect(result.error).toContain("already been used")
  })

  it("rejects expired token", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 60000),
    } as any)

    const { resetPassword } = await import("@/lib/services/password-reset.service")
    const result = await resetPassword("expired-token", "NewPass1")
    expect(result.success).toBe(false)
    expect(result.error).toContain("expired")
  })

  it("successfully resets password and creates audit log", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)
    vi.mocked(prisma.passwordResetToken.update).mockResolvedValue({} as any)
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({} as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const { resetPassword } = await import("@/lib/services/password-reset.service")
    const result = await resetPassword("valid-token", "NewPass1Word")
    expect(result.success).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "u1", action: "PASSWORD_RESET", entityType: "User", entityId: "u1" },
    })
  })
})

describe("hashToken (sha256)", () => {
  it("produces consistent hashes", async () => {
    const { hashToken } = await import("@/lib/services/password-reset.service")
    const h1 = hashToken("test")
    const h2 = hashToken("test")
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
  })
})

describe("password-reset: constants", () => {
  it("expiry is 30 minutes", async () => {
    const { TOKEN_EXPIRY_MINUTES } = await import("@/lib/services/password-reset.service")
    expect(TOKEN_EXPIRY_MINUTES).toBe(30)
  })

  it("rate limit is 5 per hour", async () => {
    const { MAX_REQUESTS_PER_HOUR } = await import("@/lib/services/password-reset.service")
    expect(MAX_REQUESTS_PER_HOUR).toBe(5)
  })
})
