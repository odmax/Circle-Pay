import { prisma } from "@/lib/prisma"

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

export async function generateRotationSchedule(circleId: string) {
  const members = await prisma.circleMember.findMany({
    where: { circleId }, orderBy: { joinedAt: "asc" }, include: { user: { select: { id: true, name: true } } },
  })
  if (members.length < 2) return []

  const existingCount = await prisma.payoutCycle.count({ where: { circleId } })
  if (existingCount > 0) return getPayoutSchedule(circleId)

  const settings = (await prisma.circle.findUnique({ where: { id: circleId }, select: { settings: true } }))?.settings as Record<string, unknown> | null
  const amount = Number(settings?.contributionAmount || 500)
  const cycles = members.length

  const created = []
  for (let i = 0; i < cycles; i++) {
    const member = members[i]
    const cycle = await prisma.payoutCycle.create({
      data: {
        circleId, cycleNumber: i + 1, recipientId: member.userId, amount,
        dueDate: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000),
      },
    })
    created.push(cycle)
  }
  return created
}

export async function getPayoutSchedule(circleId: string) {
  return prisma.payoutCycle.findMany({
    where: { circleId },
    include: { recipient: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { cycleNumber: "asc" },
  })
}

export async function getNextPayout(circleId: string) {
  return prisma.payoutCycle.findFirst({
    where: { circleId, status: "UPCOMING" },
    include: { recipient: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { cycleNumber: "asc" },
  })
}

export async function markPayoutCompleted(circleId: string, cycleId: string, userId: string) {
  await validateMember(circleId, userId)
  const cycle = await prisma.payoutCycle.findUnique({ where: { id: cycleId } })
  if (!cycle || cycle.circleId !== circleId) throw new Error("Not found")
  return prisma.payoutCycle.update({ where: { id: cycleId }, data: { status: "COMPLETED", completedAt: new Date() } })
}

export async function skipPayout(circleId: string, cycleId: string, userId: string) {
  await validateMember(circleId, userId)
  return prisma.payoutCycle.update({ where: { id: cycleId }, data: { status: "SKIPPED" } })
}

export async function getPoolCompliance(circleId: string) {
  const settings = (await prisma.circle.findUnique({ where: { id: circleId }, select: { settings: true } }))?.settings as Record<string, unknown> | null
  const expectedPerMember = Number(settings?.contributionAmount || 0)
  const members = await prisma.circleMember.count({ where: { circleId } })
  const expectedTotal = expectedPerMember * members
  const collected = await prisma.contribution.aggregate({ where: { circleId, status: "PAID", deletedAt: null }, _sum: { amount: true } })
  return { expectedPerMember, members, expectedTotal, collected: Number(collected._sum.amount ?? 0), shortfall: expectedTotal - Number(collected._sum.amount ?? 0) }
}
