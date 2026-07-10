import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: { include: { plan: { select: { name: true, slug: true } } } },
      accounts: { select: { provider: true } },
    },
  })

  if (!user) throw new Error("User not found")

  const accounts = user.accounts.map((a) => a.provider)
  const hasGoogle = accounts.includes("google")
  const hasPassword = !!user.passwordHash

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    currency: user.currency,
    image: user.image,
    createdAt: user.createdAt,
    plan: user.subscription?.plan?.name || "Free",
    planSlug: user.subscription?.plan?.slug || "free",
    planStatus: user.subscription?.status || "TRIALING",
    periodEnd: user.subscription?.currentPeriodEnd || null,
    hasPassword,
    hasGoogle,
    accounts,
  }
}

export async function updateProfile(
  userId: string,
  data: { name?: string; phone?: string | null; currency?: string }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.currency !== undefined && { currency: data.currency }),
    },
  })

  return { success: true, user: { name: user.name, phone: user.phone, currency: user.currency } }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.passwordHash) throw new Error("Password login not enabled for this account")

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) throw new Error("Current password is incorrect")

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })

  return { success: true }
}
