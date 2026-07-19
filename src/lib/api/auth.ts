import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { prisma } from "@/lib/prisma"
import { apiError } from "./errors"
import type { CirclePermission } from "@/lib/permissions/circlePermissions"

export interface AuthContext {
  userId: string
  circleId: string
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) return null
  return session.user.id
}

export async function requireCircleAccess(circleId: string, permission?: CirclePermission) {
  const userId = await requireAuth()
  if (!userId) return { error: apiError("UNAUTHORIZED", "Authentication required") }

  if (permission) {
    const allowed = await hasCirclePermission({ userId, circleId, permission })
    if (!allowed) return { error: apiError("FORBIDDEN", "You do not have permission to perform this action") }
  } else {
    const member = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
    })
    if (!member) return { error: apiError("FORBIDDEN", "You are not a member of this circle") }
  }

  return { userId, circleId }
}

export async function getMembership(circleId: string, userId: string) {
  return prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
    select: { role: true, permissions: { select: { permission: true, granted: true } } },
  })
}
