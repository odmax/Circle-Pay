import { prisma } from "@/lib/prisma"

export async function createAuditLog(data: {
  userId?: string | null
  circleId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}) {
  const createData: Record<string, unknown> = {
    userId: data.userId || null,
    circleId: data.circleId || null,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId || null,
    }
    if (data.oldValues) (createData as Record<string, unknown>).oldValues = data.oldValues
    if (data.newValues) (createData as Record<string, unknown>).newValues = data.newValues

    return prisma.auditLog.create({ data: createData as Parameters<typeof prisma.auditLog.create>[0]["data"] })
}

export async function getCircleAuditLogs(circleId: string, userId: string) {
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  })
  if (!member) throw new Error("Not a member")

  const logs = await prisma.auditLog.findMany({
    where: { circleId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return logs
}

export async function getOwnerAuditLogs() {
  return prisma.auditLog.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      circle: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}
