import { prisma } from "@/lib/prisma"
import type { MemberRole } from "@/generated/prisma"
import type { CirclePermission } from "@/lib/permissions/circlePermissions"
import { getCircleMemberPermissions } from "@/lib/permissions/circle-permissions"
import {
  preventOwnerDemotion,
  preventOwnerRemoval,
  preventSelfPromotion,
  preventSelfRemoval,
  validateGrantablePermissions,
  getOwnerCount,
} from "@/lib/permissions/ownership-protection"
import { createAuditLog } from "@/lib/services/audit.service"

export async function getMemberPermissionSummary(
  circleId: string,
  membershipId: string,
  actorUserId: string
) {
  const membership = await prisma.circleMember.findUnique({
    where: { id: membershipId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      permissions: { select: { permission: true, granted: true } },
    },
  })

  if (!membership || membership.circleId !== circleId) {
    throw new Error("Member not found")
  }

  const actorPerms = await getCircleMemberPermissions({
    userId: actorUserId,
    circleId,
  })
  if (!actorPerms) throw new Error("Not a member of this circle")

  const effective = await getCircleMemberPermissions({
    userId: membership.userId,
    circleId,
  })

  return {
    membershipId: membership.id,
    user: membership.user,
    role: membership.role,
    effectivePermissions: effective?.permissions ?? [],
    overrides: membership.permissions,
    overrideCount: membership.permissions.length,
  }
}

export async function updateMemberRole({
  circleId,
  membershipId,
  role,
  actorUserId,
}: {
  circleId: string
  membershipId: string
  role: MemberRole
  actorUserId: string
}) {
  const actorPerms = await getCircleMemberPermissions({
    userId: actorUserId,
    circleId,
  })
  if (!actorPerms) throw new Error("Not a member of this circle")
  if (!actorPerms.permissions.includes("MEMBER_ROLE_UPDATE" as CirclePermission)) {
    throw new Error("Insufficient permissions")
  }

  const member = await prisma.circleMember.findUnique({
    where: { id: membershipId },
  })
  if (!member || member.circleId !== circleId) {
    throw new Error("Member not found")
  }

  preventSelfPromotion(actorUserId, member.userId)
  await preventOwnerDemotion(circleId, membershipId, role)

  if (member.role === "OWNER" && role !== "OWNER") {
    const ownerCount = await getOwnerCount(circleId)
    if (ownerCount <= 1) {
      throw new Error("Cannot demote the last owner of the circle")
    }
  }

  const oldRole = member.role
  if (oldRole === role) return member

  const updated = await prisma.circleMember.update({
    where: { id: membershipId },
    data: { role },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  createAuditLog({
    userId: actorUserId,
    circleId,
    action: "CIRCLE_MEMBER_ROLE_CHANGED",
    entityType: "CircleMember",
    entityId: membershipId,
    oldValues: { role: oldRole },
    newValues: { role },
  }).catch(console.error)

  return updated
}

export async function setMemberPermissionOverride({
  circleId,
  membershipId,
  permission,
  granted,
  actorUserId,
}: {
  circleId: string
  membershipId: string
  permission: CirclePermission
  granted: boolean
  actorUserId: string
}) {
  const actorPerms = await getCircleMemberPermissions({
    userId: actorUserId,
    circleId,
  })
  if (!actorPerms) throw new Error("Not a member of this circle")
  if (
    !actorPerms.permissions.includes(
      "MEMBER_PERMISSION_MANAGE" as CirclePermission
    )
  ) {
    throw new Error("Insufficient permissions")
  }

  validateGrantablePermissions(actorPerms.permissions, [permission])

  const member = await prisma.circleMember.findUnique({
    where: { id: membershipId },
  })
  if (!member || member.circleId !== circleId) {
    throw new Error("Member not found")
  }

  if (member.role === "OWNER" && !granted) {
    throw new Error("Cannot deny permissions for the circle owner")
  }

  const existing = await prisma.circleMemberPermission.findUnique({
    where: { membershipId_permission: { membershipId, permission } },
  })

  const oldOverride = existing
    ? { granted: existing.granted }
    : null

  const updated = await prisma.circleMemberPermission.upsert({
    where: { membershipId_permission: { membershipId, permission } },
    create: {
      membershipId,
      permission,
      granted,
      grantedById: actorUserId,
    },
    update: {
      granted,
      grantedById: actorUserId,
    },
  })

  createAuditLog({
    userId: actorUserId,
    circleId,
    action: granted
      ? "CIRCLE_MEMBER_PERMISSION_GRANTED"
      : "CIRCLE_MEMBER_PERMISSION_DENIED",
    entityType: "CircleMemberPermission",
    entityId: updated.id,
    oldValues: oldOverride,
    newValues: { granted, permission },
  }).catch(console.error)

  return updated
}

export async function removeMemberPermissionOverride({
  circleId,
  membershipId,
  permission,
  actorUserId,
}: {
  circleId: string
  membershipId: string
  permission: CirclePermission
  actorUserId: string
}) {
  const actorPerms = await getCircleMemberPermissions({
    userId: actorUserId,
    circleId,
  })
  if (!actorPerms) throw new Error("Not a member of this circle")
  if (
    !actorPerms.permissions.includes(
      "MEMBER_PERMISSION_MANAGE" as CirclePermission
    )
  ) {
    throw new Error("Insufficient permissions")
  }

  const member = await prisma.circleMember.findUnique({
    where: { id: membershipId },
  })
  if (!member || member.circleId !== circleId) {
    throw new Error("Member not found")
  }

  const existing = await prisma.circleMemberPermission.findUnique({
    where: { membershipId_permission: { membershipId, permission } },
  })

  if (existing) {
    await prisma.circleMemberPermission.delete({
      where: { id: existing.id },
    })

    createAuditLog({
      userId: actorUserId,
      circleId,
      action: "CIRCLE_MEMBER_PERMISSION_OVERRIDE_REMOVED",
      entityType: "CircleMemberPermission",
      entityId: existing.id,
      oldValues: { permission, granted: existing.granted },
      newValues: null,
    }).catch(console.error)
  }

  return { success: true }
}

export async function removeMember({
  circleId,
  actorUserId,
  membershipId,
}: {
  circleId: string
  actorUserId: string
  membershipId: string
}) {
  const actorPerms = await getCircleMemberPermissions({
    userId: actorUserId,
    circleId,
  })
  if (!actorPerms) throw new Error("Not a member of this circle")
  if (!actorPerms.permissions.includes("MEMBER_REMOVE" as CirclePermission)) {
    throw new Error("Insufficient permissions")
  }

  const member = await prisma.circleMember.findUnique({
    where: { id: membershipId },
  })
  if (!member || member.circleId !== circleId) {
    throw new Error("Member not found")
  }

  preventSelfRemoval(actorUserId, member.userId)
  await preventOwnerRemoval(circleId, membershipId)

  const oldRole = member.role

  await prisma.circleMember.delete({ where: { id: membershipId } })

  createAuditLog({
    userId: actorUserId,
    circleId,
    action: "CIRCLE_MEMBER_REMOVED",
    entityType: "CircleMember",
    entityId: membershipId,
    oldValues: { role: oldRole, userId: member.userId },
    newValues: null,
  }).catch(console.error)

  return { success: true }
}
