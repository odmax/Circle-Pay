import { prisma } from "@/lib/prisma"
import type { CirclePollType } from "@/generated/prisma"

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function requireAdmin(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } }, select: { role: true } })
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) throw new Error("Admin required")
}

export async function getCirclePolls(circleId: string) {
  return prisma.circlePoll.findMany({
    where: { circleId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      options: { include: { _count: { select: { votes: true } } }, orderBy: { sortOrder: "asc" } },
      _count: { select: { votes: true } },
      votes: { select: { userId: true, optionId: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createPoll(circleId: string, userId: string, data: { title: string; description?: string; type?: string; options: string[]; closesAt?: string; isAnonymous?: boolean }) {
  await requireAdmin(circleId, userId)
  return prisma.circlePoll.create({
    data: {
      circleId, createdById: userId, title: data.title, description: data.description,
      type: (data.type || "YES_NO") as CirclePollType, closesAt: data.closesAt ? new Date(data.closesAt) : null,
      isAnonymous: data.isAnonymous || false,
      options: { create: data.options.map((text, i) => ({ text, sortOrder: i })) },
    },
    include: { options: true },
  })
}

export async function votePoll(circleId: string, pollId: string, userId: string, optionId: string) {
  await validateMember(circleId, userId)
  const poll = await prisma.circlePoll.findUnique({ where: { id: pollId } })
  if (!poll || poll.status !== "OPEN") throw new Error("Poll is not open")

  return prisma.circlePollVote.upsert({
    where: { pollId_userId: { pollId, userId } },
    create: { pollId, optionId, userId },
    update: { optionId },
  })
}

export async function closePoll(circleId: string, pollId: string, userId: string) {
  await requireAdmin(circleId, userId)
  return prisma.circlePoll.update({ where: { id: pollId }, data: { status: "CLOSED" } })
}
