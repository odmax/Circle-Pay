import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export interface HouseholdCtx {
  userId: string
  circleId: string
  isManager: boolean
}

export async function getHouseholdCtx(circleId: string): Promise<HouseholdCtx | null> {
  const s = await auth()
  if (!s?.user?.id) return null
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return null
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "HOUSEMATE") return null
  const isManager = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.HOUSEHOLD_MANAGE })
  return { userId: s.user.id, circleId, isManager }
}