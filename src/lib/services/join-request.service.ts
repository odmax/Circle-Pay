import { prisma } from "@/lib/prisma"

async function requireRole(circleId: string, userId: string, allowed: string[]) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } }, select: { role: true } })
  if (!m) throw new Error("Not a member")
  if (!allowed.includes(m.role)) throw new Error("Insufficient permissions")
  return m.role
}

export async function requestToJoin(circleId: string, userId: string, message?: string | null) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId } })
  if (!circle) throw new Error("Circle not found")
  if (circle.visibility === "PRIVATE") throw new Error("This circle is private")

  const existing = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (existing) throw new Error("Already a member")

  const dup = await prisma.joinRequest.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (dup && dup.status === "PENDING") throw new Error("Join request already pending")

  return prisma.joinRequest.create({ data: { circleId, userId, message: message || null } })
}

export async function getJoinRequests(circleId: string, userId: string) {
  await requireRole(circleId, userId, ["OWNER", "ADMIN"])
  return prisma.joinRequest.findMany({
    where: { circleId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function getPendingCount(circleId: string, userId: string) {
  await requireRole(circleId, userId, ["OWNER", "ADMIN"])
  return prisma.joinRequest.count({ where: { circleId, status: "PENDING" } })
}

export async function approveJoinRequest(circleId: string, requestId: string, reviewerId: string) {
  await requireRole(circleId, reviewerId, ["OWNER", "ADMIN"])
  const req = await prisma.joinRequest.findUnique({ where: { id: requestId } })
  if (!req || req.circleId !== circleId) throw new Error("Request not found")
  if (req.status !== "PENDING") throw new Error("Request is not pending")

  await prisma.joinRequest.update({ where: { id: requestId }, data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() } })
  await prisma.circleMember.create({ data: { circleId, userId: req.userId, role: "MEMBER" } })
  return { success: true }
}

export async function rejectJoinRequest(circleId: string, requestId: string, reviewerId: string) {
  await requireRole(circleId, reviewerId, ["OWNER", "ADMIN"])
  const req = await prisma.joinRequest.findUnique({ where: { id: requestId } })
  if (!req || req.circleId !== circleId) throw new Error("Request not found")
  if (req.status !== "PENDING") throw new Error("Request is not pending")

  await prisma.joinRequest.update({ where: { id: requestId }, data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date() } })
  return { success: true }
}
