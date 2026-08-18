import crypto from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/services/email.service"

const TOKEN_EXPIRY_MINUTES = 30
const MAX_REQUESTS_PER_HOUR = 5

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

  if (!user) return { success: true }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCount = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: oneHourAgo } },
  })
  if (recentCount >= MAX_REQUESTS_PER_HOUR) return { success: true }

  const rawToken = crypto.randomBytes(32).toString("base64url")
  const tokenHash = sha256(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`

  await sendPasswordResetEmail(user.email, resetUrl)

  return { success: true }
}

export async function resetPassword(
  rawToken: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const tokenHash = sha256(rawToken)

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  })

  if (!record) return { success: false, error: "Invalid or expired reset link." }
  if (record.usedAt) return { success: false, error: "This reset link has already been used." }
  if (new Date() > record.expiresAt) return { success: false, error: "This reset link has expired." }

  const hash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: hash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
    prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: "PASSWORD_RESET",
        entityType: "User",
        entityId: record.userId,
      },
    }),
  ])

  return { success: true }
}

export async function verifyResetToken(
  rawToken: string
): Promise<{ valid: boolean; error?: string }> {
  const tokenHash = sha256(rawToken)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record) return { valid: false, error: "Invalid reset link." }
  if (record.usedAt) return { valid: false, error: "This reset link has already been used." }
  if (new Date() > record.expiresAt) return { valid: false, error: "This reset link has expired." }

  return { valid: true }
}

export { sha256 as hashToken, TOKEN_EXPIRY_MINUTES, MAX_REQUESTS_PER_HOUR }
