import { prisma } from "@/lib/prisma"
import type { MemberRole } from "@/generated/prisma"
import type { CirclePermission } from "./circlePermissions"
import { getRoleDefaultPermissions } from "./circle-role-permissions"

export class CirclePermissionDeniedError extends Error {
  constructor(circleId: string, permission: string) {
    super(`Permission denied: ${permission} in circle ${circleId}`)
    this.name = "CirclePermissionDeniedError"
  }
}

export type CircleMemberPermissionsResult = {
  membershipId: string
  userId: string
  circleId: string
  role: MemberRole
  permissions: CirclePermission[]
}

export async function getCircleMemberPermissions({
  userId,
  circleId,
}: {
  userId: string
  circleId: string
}): Promise<CircleMemberPermissionsResult | null> {
  const membership = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
    select: {
      id: true,
      userId: true,
      circleId: true,
      role: true,
      circle: { select: { isActive: true, deletedAt: true } },
      permissions: {
        select: { permission: true, granted: true },
      },
    },
  })

  if (!membership) return null
  if (!membership.circle.isActive || membership.circle.deletedAt) return null

  const roleDefaults = getRoleDefaultPermissions(membership.role)
  const effective = applyOverrides(roleDefaults, membership.permissions)

  return {
    membershipId: membership.id,
    userId: membership.userId,
    circleId: membership.circleId,
    role: membership.role,
    permissions: effective,
  }
}

export async function hasCirclePermission({
  userId,
  circleId,
  permission,
}: {
  userId: string
  circleId: string
  permission: CirclePermission
}): Promise<boolean> {
  const result = await getCircleMemberPermissions({ userId, circleId })
  if (!result) return false
  return result.permissions.includes(permission)
}

export async function requireCirclePermission({
  userId,
  circleId,
  permission,
}: {
  userId: string
  circleId: string
  permission: CirclePermission
}): Promise<void> {
  const allowed = await hasCirclePermission({ userId, circleId, permission })
  if (!allowed) {
    throw new CirclePermissionDeniedError(circleId, permission)
  }
}

function applyOverrides(
  roleDefaults: CirclePermission[],
  overrides: { permission: string; granted: boolean }[]
): CirclePermission[] {
  const granted = new Set<CirclePermission>()
  const denied = new Set<string>()

  for (const perm of roleDefaults) {
    granted.add(perm)
  }

  for (const override of overrides) {
    if (override.granted) {
      granted.add(override.permission as CirclePermission)
    } else {
      denied.add(override.permission)
      granted.delete(override.permission as CirclePermission)
    }
  }

  return Array.from(granted)
}
