import { prisma } from "@/lib/prisma"

export async function calculateCircleReputation(circleId: string) {
  const [stats, goals, payoutCycles, events, polls] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.goal.findMany({ where: { circleId, deletedAt: null }, select: { status: true } }).then((g) => ({ completed: g.filter((x) => x.status === "COMPLETED").length, total: g.length })),
    prisma.payoutCycle.findMany({ where: { circleId }, select: { status: true } }).then((p) => ({ completed: p.filter((x) => x.status === "COMPLETED").length, total: p.length })),
    prisma.circleEvent.findMany({ where: { circleId, deletedAt: null }, select: { status: true } }).then((e) => ({ completed: e.filter((x) => x.status === "COMPLETED").length, total: e.length })),
    prisma.circlePoll.findMany({ where: { circleId, deletedAt: null }, include: { _count: { select: { votes: true } } } }),
    ])

  const pollsWithVotes = polls.length
  const [contribCompliance, totalContribs] = await Promise.all([
    prisma.contribution.count({ where: { circleId, status: "PAID", deletedAt: null } }),
    prisma.contribution.count({ where: { circleId, deletedAt: null } }),
  ])
  const compliance = totalContribs > 0 ? Math.round((contribCompliance / totalContribs) * 100) : 0
  const goalRate = goals.total > 0 ? Math.round((goals.completed / goals.total) * 100) : 0
  const payoutRate = payoutCycles.total > 0 ? Math.round((payoutCycles.completed / payoutCycles.total) * 100) : 0
  const eventRate = events.total > 0 ? Math.round((events.completed / events.total) * 100) : 0

  const scores = [compliance, goalRate, payoutRate, eventRate]
  if (polls.length > 0) {
    const avgParticipation = polls.reduce((s, p) => s + p._count.votes, 0) / (polls.length * stats)
    scores.push(Math.min(100, Math.round(avgParticipation * 100)))
  }

  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  await prisma.circleReputation.upsert({
    where: { circleId },
    create: { circleId, score, memberCount: stats, contributionCompliance: compliance, goalCompletionRate: goalRate, payoutCompletionRate: payoutRate, eventParticipationRate: eventRate },
    update: { score, memberCount: stats, contributionCompliance: compliance, goalCompletionRate: goalRate, payoutCompletionRate: payoutRate, eventParticipationRate: eventRate },
  })

  return { score, memberCount: stats, contributionCompliance: compliance, goalCompletionRate: goalRate, payoutCompletionRate: payoutRate, eventParticipationRate: eventRate }
}

export async function getCircleReputation(circleId: string) {
  const rep = await prisma.circleReputation.findUnique({ where: { circleId } })
  if (!rep) return calculateCircleReputation(circleId)
  return rep
}

export async function getVerifications(status?: string) {
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  return prisma.circleVerification.findMany({
    where,
    include: { circle: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function submitVerification(circleId: string) {
  return prisma.circleVerification.upsert({
    where: { circleId },
    create: { circleId, status: "PENDING", submittedAt: new Date() },
    update: { status: "PENDING", submittedAt: new Date() },
  })
}

export async function approveVerification(circleId: string, reviewerId: string) {
  return prisma.circleVerification.update({
    where: { circleId },
    data: { status: "VERIFIED", reviewedById: reviewerId, reviewedAt: new Date() },
  })
}

export async function rejectVerification(circleId: string, reviewerId: string, notes?: string) {
  return prisma.circleVerification.update({
    where: { circleId },
    data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date(), notes: notes || null },
  })
}
