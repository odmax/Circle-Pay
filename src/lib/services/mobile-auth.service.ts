import { prisma } from "@/lib/prisma"
import crypto from "crypto"

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function createMobileSession(userId: string, metadata?: { deviceName?: string; deviceId?: string; platform?: string }) {
  const token = crypto.randomBytes(32).toString("hex")
  await prisma.mobileSession.create({
    data: {
      userId, tokenHash: hashToken(token),
      deviceName: metadata?.deviceName || null, deviceId: metadata?.deviceId || null, platform: metadata?.platform || null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  return token
}

export async function verifyMobileToken(token: string) {
  const tokenHash = hashToken(token)
  const session = await prisma.mobileSession.findUnique({ where: { tokenHash } })
  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null
  await prisma.mobileSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
  return session.userId
}

export async function revokeMobileSession(token: string) {
  const tokenHash = hashToken(token)
  await prisma.mobileSession.update({ where: { tokenHash }, data: { revokedAt: new Date() } }).catch(() => {})
}

export async function getMobileUserFromRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) throw new Error("Unauthorized")
  const userId = await verifyMobileToken(token)
  if (!userId) throw new Error("Invalid or expired token")
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true, currency: true, phone: true, isSuspended: true } })
  if (!user || user.isSuspended) throw new Error("User not found or suspended")
  return user
}

export async function cleanupExpiredMobileSessions() {
  await prisma.mobileSession.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] } })
}
