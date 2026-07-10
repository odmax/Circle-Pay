import { prisma } from "@/lib/prisma"

export async function getDiscoverCircles(
  userId: string,
  filters?: { type?: string; country?: string; search?: string }
) {
  const where: Record<string, unknown> = {
    visibility: "PUBLIC",
    isActive: true,
    deletedAt: null,
  }

  if (filters?.type) where.type = filters.type
  if (filters?.country) where.country = { contains: filters.country, mode: "insensitive" }
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { publicDescription: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  const circles = await prisma.circle.findMany({
    where,
    include: {
      _count: { select: { members: true } },
      members: { where: { userId }, select: { userId: true } },
      joinRequests: { where: { userId, status: "PENDING" }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return circles.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    country: c.country,
    city: c.city,
    visibility: c.visibility,
    publicDescription: c.publicDescription,
    joinApprovalRequired: c.joinApprovalRequired,
    settings: c.settings as Record<string, unknown> | null,
    memberCount: c._count.members,
    isMember: c.members.length > 0,
    hasPendingRequest: c.joinRequests.length > 0,
  }))
}
