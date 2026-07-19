import { prisma } from "@/lib/prisma"
import type { CircleEventType } from "@/generated/prisma"

import type { CircleEventRSVPStatus } from "@/generated/prisma"
import { requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

export async function getCircleEvents(circleId: string) {
  return prisma.circleEvent.findMany({
    where: { circleId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { rsvps: true } },
      rsvps: { select: { userId: true, status: true } },
    },
    orderBy: { startAt: "asc" },
  })
}

export async function createCircleEvent(circleId: string, userId: string, data: { title: string; description?: string; type?: string; startAt: string; endAt?: string; location?: string; isOnline?: boolean; meetingLink?: string; agenda?: string }) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EVENT_MANAGE })
  return prisma.circleEvent.create({
    data: {
      circleId, createdById: userId, title: data.title, description: data.description,
      type: (data.type || "GENERAL") as CircleEventType, startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null, location: data.location,
      isOnline: data.isOnline || false, meetingLink: data.meetingLink, agenda: data.agenda,
    },
  })
}

export async function rsvpToEvent(circleId: string, eventId: string, userId: string, status: string) {
  await validateMember(circleId, userId)
  return prisma.circleEventRSVP.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, status: status as CircleEventRSVPStatus },
    update: { status: status as CircleEventRSVPStatus },
  })
}

export async function cancelEvent(circleId: string, eventId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EVENT_MANAGE })
  return prisma.circleEvent.update({ where: { id: eventId }, data: { status: "CANCELLED" } })
}
