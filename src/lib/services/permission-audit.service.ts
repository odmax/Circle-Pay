import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

export const PERMISSION_AUDIT_ACTIONS = {
  ROLE_CHANGED: "CIRCLE_MEMBER_ROLE_CHANGED",
  PERMISSION_GRANTED: "CIRCLE_MEMBER_PERMISSION_GRANTED",
  PERMISSION_DENIED: "CIRCLE_MEMBER_PERMISSION_DENIED",
  OVERRIDE_REMOVED: "CIRCLE_MEMBER_PERMISSION_OVERRIDE_REMOVED",
  MEMBER_REMOVED: "CIRCLE_MEMBER_REMOVED",
  OWNERSHIP_TRANSFERRED: "CIRCLE_OWNERSHIP_TRANSFERRED",
} as const

export type PermissionAuditAction =
  (typeof PERMISSION_AUDIT_ACTIONS)[keyof typeof PERMISSION_AUDIT_ACTIONS]

export type PermissionAuditFilter = {
  circleId: string
  affectedUserId?: string
  actorUserId?: string
  action?: PermissionAuditAction
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

export type PermissionAuditEntry = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  affectedUserId: string | null
  reason: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: Date
  actor: { id: string; name: string | null; email: string; image: string | null } | null
  affectedUser: { id: string; name: string | null; email: string; image: string | null } | null
}

export async function logPermissionAuditEvent({
  circleId,
  actorUserId,
  affectedUserId,
  action,
  entityType,
  entityId,
  reason,
  oldValues,
  newValues,
}: {
  circleId: string
  actorUserId: string
  affectedUserId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  reason?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}) {
  return createAuditLog({
    userId: actorUserId,
    circleId,
    affectedUserId: affectedUserId || null,
    action,
    entityType,
    entityId: entityId || null,
    reason: reason || null,
    oldValues: oldValues || null,
    newValues: newValues || null,
  })
}

export async function getPermissionAuditHistory({
  circleId,
  affectedUserId,
  actorUserId,
  action,
  fromDate,
  toDate,
  page = 1,
  pageSize = 50,
}: PermissionAuditFilter) {
  const where: Record<string, unknown> = { circleId }

  const PERMISSION_ACTIONS = Object.values(PERMISSION_AUDIT_ACTIONS)
  where.action = { in: PERMISSION_ACTIONS }

  if (affectedUserId) {
    where.affectedUserId = affectedUserId
  }

  if (actorUserId) {
    where.userId = actorUserId
  }

  if (action) {
    where.action = action
  }

  if (fromDate || toDate) {
    where.createdAt = {}
    if (fromDate) (where.createdAt as Record<string, unknown>).gte = new Date(fromDate)
    if (toDate) {
      const to = new Date(toDate)
      to.setHours(23, 59, 59, 999)
      ;(where.createdAt as Record<string, unknown>).lte = to
    }
  }

  const skip = (page - 1) * pageSize

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as never,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where: where as never }),
  ])

  const entries: PermissionAuditEntry[] = logs.map((log) => {
    const oldVals = log.oldValues as Record<string, unknown> | null

    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      affectedUserId: log.affectedUserId,
      reason: (log as Record<string, unknown>).reason as string | null,
      oldValues: oldVals,
      newValues: log.newValues as Record<string, unknown> | null,
      createdAt: log.createdAt,
      actor: log.user,
      affectedUser: null,
    }
  })

  const affectedUserIds = [
    ...new Set(entries.map((e) => e.affectedUserId).filter(Boolean) as string[]),
  ]

  if (affectedUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: affectedUserIds } },
      select: { id: true, name: true, email: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    for (const entry of entries) {
      if (entry.affectedUserId) {
        entry.affectedUser = userMap.get(entry.affectedUserId) || null
      }
    }
  }

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
