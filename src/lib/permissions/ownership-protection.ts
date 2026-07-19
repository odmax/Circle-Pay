import { prisma } from "@/lib/prisma"
import type { MemberRole } from "@/generated/prisma"
import { CIRCLE_PERMISSIONS, type CirclePermission } from "./circlePermissions"

export async function isCircleOwner(
  circleId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
    select: { role: true },
  })
  return member?.role === "OWNER"
}

export async function getOwnerCount(circleId: string): Promise<number> {
  return prisma.circleMember.count({
    where: { circleId, role: "OWNER" },
  })
}

export async function preventOwnerRemoval(
  circleId: string,
  membershipId: string
): Promise<void> {
  const member = await prisma.circleMember.findUnique({
    where: { id: membershipId },
    select: { role: true, circleId: true },
  })
  if (!member || member.circleId !== circleId) return
  if (member.role !== "OWNER") return

  const ownerCount = await getOwnerCount(circleId)
  if (ownerCount <= 1) {
    throw new Error("Cannot remove the last owner of the circle")
  }
}

export async function preventOwnerDemotion(
  circleId: string,
  membershipId: string,
  newRole: MemberRole
): Promise<void> {
  const member = await prisma.circleMember.findUnique({
    where: { id: membershipId },
    select: { role: true, circleId: true },
  })
  if (!member || member.circleId !== circleId) return
  if (member.role !== "OWNER") return
  if (newRole !== "OWNER") {
    const ownerCount = await getOwnerCount(circleId)
    if (ownerCount <= 1) {
      throw new Error("Cannot demote the last owner of the circle")
    }
  }
}

export function preventSelfPromotion(
  actorUserId: string,
  targetUserId: string
): void {
  if (actorUserId === targetUserId) {
    throw new Error("Cannot promote yourself")
  }
}

export function preventSelfRemoval(
  actorUserId: string,
  targetUserId: string
): void {
  if (actorUserId === targetUserId) {
    throw new Error("Cannot remove yourself from the circle")
  }
}

export function validateGrantablePermissions(
  actorPermissions: CirclePermission[],
  permissionsToGrant: CirclePermission[]
): void {
  for (const perm of permissionsToGrant) {
    if (!actorPermissions.includes(perm)) {
      throw new Error(
        `Cannot grant permission you do not possess: ${perm}`
      )
    }
  }
}

export function ownerCannotBeDenied(permission: CirclePermission): boolean {
  return permission === CIRCLE_PERMISSIONS.MEMBER_ROLE_UPDATE ||
    permission === CIRCLE_PERMISSIONS.MEMBER_REMOVE ||
    permission === CIRCLE_PERMISSIONS.CIRCLE_DELETE ||
    permission === CIRCLE_PERMISSIONS.MEMBER_PERMISSION_MANAGE
}
