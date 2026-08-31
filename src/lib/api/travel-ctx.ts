import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export interface TravelCtx {
  userId: string
  circleId: string
  tripId: string
  isManager: boolean
}

export async function getTravelCtx(circleId: string): Promise<TravelCtx | null> {
  const s = await auth()
  if (!s?.user?.id) return null
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return null
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "TRAVEL") return null
  const trip = await prisma.travelTrip.findUnique({ where: { circleId }, select: { id: true } })
  if (!trip) return null
  const isManager = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE })
  return { userId: s.user.id, circleId, tripId: trip.id, isManager }
}