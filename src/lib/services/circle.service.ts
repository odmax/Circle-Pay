import { prisma } from "@/lib/prisma"
import type { CircleType, MemberRole } from "@/generated/prisma"
import { notifyCircleMembers } from "@/lib/services/notification.service"
import { createAuditLog } from "@/lib/services/audit.service"
import { createSystemPost } from "@/lib/services/feed.service"
import { markCircleStale } from "@/lib/services/snapshot.service"
import { APP_URL } from "@/lib/constants"
import {
  requireCirclePermission,
} from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  removeMember as removeMemberViaService,
  updateMemberRole as updateMemberRoleViaService,
} from "@/lib/services/circle-permission.service"

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function getUserCircles(userId: string) {
  const memberships = await prisma.circleMember.findMany({
    where: { userId, circle: { deletedAt: null } },
    include: {
      circle: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { circle: { updatedAt: "desc" } },
  })

  return memberships.map((m) => ({
    id: m.circle.id,
    name: m.circle.name,
    description: m.circle.description,
    currency: m.circle.currency,
    type: m.circle.type,
    inviteCode: m.circle.inviteCode,
    isActive: m.circle.isActive,
    createdAt: m.circle.createdAt,
    memberCount: m.circle._count.members,
    role: m.role,
  }))
}

export async function getCircleById(circleId: string, userId: string) {
  await requireCirclePermission({
    userId,
    circleId,
    permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
  })

  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    include: {
      _count: { select: { members: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  })

  if (!circle) throw new Error("Circle not found")

  const userMembership = circle.members.find((m) => m.userId === userId)

  return {
    ...circle,
    memberCount: circle._count.members,
    userRole: userMembership?.role ?? null,
  }
}

export async function createCircle(
  userId: string,
  data: { name: string; description?: string | null; type: string; currency: string; settings?: Record<string, unknown> | null }
) {
  let inviteCode = generateInviteCode()

  let codeExists = await prisma.circle.findUnique({
    where: { inviteCode },
  })
  while (codeExists) {
    inviteCode = generateInviteCode()
    codeExists = await prisma.circle.findUnique({ where: { inviteCode } })
  }

  const circle = await prisma.circle.create({
    data: {
      name: data.name,
      description: data.description || null,
      type: data.type as CircleType,
      currency: data.currency,
      inviteCode,
      createdById: userId,
      settings: data.settings ? JSON.parse(JSON.stringify(data.settings)) : undefined,
      members: {
        create: { userId, role: "OWNER" as const },
      },
    },
  })

  return circle
}

export async function updateCircle(
  circleId: string,
  userId: string,
  data: { name?: string; description?: string | null; currency?: string; settings?: Record<string, unknown> | null }
) {
  await requireCirclePermission({
    userId,
    circleId,
    permission: CIRCLE_PERMISSIONS.CIRCLE_UPDATE,
  })

  const settingsValue =
    data.settings !== undefined
      ? data.settings === null
        ? null
        : JSON.parse(JSON.stringify(data.settings))
      : undefined

  const circle = await prisma.circle.update({
    where: { id: circleId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(settingsValue !== undefined && { settings: settingsValue }),
    },
  })

  return circle
}

export async function deleteCircle(circleId: string, userId: string) {
  await requireCirclePermission({
    userId,
    circleId,
    permission: CIRCLE_PERMISSIONS.CIRCLE_DELETE,
  })

  await prisma.circle.update({
    where: { id: circleId },
    data: { isActive: false, deletedAt: new Date() },
  })

  await createAuditLog({ userId, circleId, action: "SOFT_DELETE", entityType: "Circle", entityId: circleId, newValues: { deletedAt: new Date().toISOString() } })

  return { success: true }
}

export async function getCircleMembers(circleId: string, userId: string) {
  await requireCirclePermission({
    userId,
    circleId,
    permission: CIRCLE_PERMISSIONS.MEMBER_VIEW,
  })

  const members = await prisma.circleMember.findMany({
    where: { circleId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
      permissions: { select: { permission: true, granted: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  })

  return members.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.joinedAt,
    user: m.user,
    overrideCount: m.permissions.length,
  }))
}

export async function addMember(
  circleId: string,
  actorUserId: string,
  email: string,
  role: "ADMIN" | "MEMBER" | "TREASURER" | "VIEWER" = "MEMBER"
) {
  await requireCirclePermission({
    userId: actorUserId,
    circleId,
    permission: CIRCLE_PERMISSIONS.MEMBER_INVITE,
  })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error("User with this email not found")

  const existing = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: user.id } },
  })
  if (existing) throw new Error("User is already a member")

  const member = await prisma.circleMember.create({
    data: { circleId, userId: user.id, role },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } })
  const name = member.user.name || member.user.email
  notifyCircleMembers(circleId, actorUserId, {
    type: "NEW_MEMBER_JOINED",
    title: `${name} joined`,
    message: `${name} joined ${circle?.name || "the circle"}`,
    link: `/circles/${circleId}/members`,
  })

  createSystemPost(circleId, { type: "SYSTEM", content: `${name} joined ${circle?.name || "the circle"} 🎉` }).catch(console.error)

  markCircleStale(circleId).catch(console.error)

  return member
}

export async function removeMember(
  circleId: string,
  actorUserId: string,
  memberIdToRemove: string
) {
  return removeMemberViaService({ circleId, actorUserId, membershipId: memberIdToRemove })
}

export async function updateMemberRole(
  circleId: string,
  actorUserId: string,
  memberId: string,
  newRole: "ADMIN" | "MEMBER" | "TREASURER" | "VIEWER"
) {
  return updateMemberRoleViaService({
    circleId,
    membershipId: memberId,
    role: newRole as MemberRole,
    actorUserId,
  })
}

export async function joinByInviteCode(inviteCode: string, userId: string) {
  const circle = await prisma.circle.findUnique({
    where: { inviteCode },
  })

  if (!circle) throw new Error("Invalid invite code")
  if (!circle.isActive) throw new Error("This circle is no longer active")

  const existing = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId: circle.id, userId } },
  })
  if (existing) throw new Error("You are already a member of this circle")

  await prisma.circleMember.create({
    data: {
      circleId: circle.id,
      userId,
      role: "MEMBER",
    },
  })

  return { circleId: circle.id, name: circle.name }
}

export async function getCircleStats(circleId: string, userId: string) {
  await requireCirclePermission({
    userId,
    circleId,
    permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
  })

  const [memberCount, totalContributions, activeGoals, pendingBalances] =
    await Promise.all([
      prisma.circleMember.count({ where: { circleId } }),
      prisma.contribution.aggregate({
        where: { circleId, deletedAt: null, status: { in: ["PAID", "CONFIRMED"] } },
        _sum: { amount: true },
      }),
      prisma.goal.count({
        where: { circleId, status: "ACTIVE" },
      }),
      prisma.balance.count({
        where: { circleId, amount: { gt: 0 } },
      }),
    ])

  return {
    memberCount,
    totalContributions: Number(totalContributions._sum.amount ?? 0),
    activeGoals,
    pendingBalances,
  }
}

export async function getInviteLink(circleId: string, userId: string) {
  await requireCirclePermission({
    userId,
    circleId,
    permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
  })

  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: { inviteCode: true },
  })

  if (!circle) throw new Error("Circle not found")

  return {
    code: circle.inviteCode,
    link: `${APP_URL}/circles/join/${circle.inviteCode}`,
  }
}
