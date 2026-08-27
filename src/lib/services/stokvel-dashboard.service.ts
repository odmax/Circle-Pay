import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getPayoutSchedule, getNextPayout, getPoolCompliance } from "@/lib/services/payout-cycle.service"
import { getContributionSchedules } from "@/lib/services/contribution-schedule.service"
import { getGoals, getGoalStats } from "@/lib/services/goal.service"
import { getCircleEvents } from "@/lib/services/event.service"
import { getUserNotifications } from "@/lib/services/notification.service"

export interface StokvelDashboardData {
  circle: {
    id: string
    name: string
    currency: string
    memberCount: number
    settings: Record<string, unknown>
  }
  my: {
    monthlyContribution: number
    contributionStatus: string
    nextDueDate: string | null
    daysRemaining: number | null
    totalContributed: number
    outstandingAmount: number
    paymentStreak: number
    payoutPosition: number | null
    payoutAmount: number | null
    payoutDate: string | null
    proofStatus: string | null
  }
  group: {
    expectedPool: number
    collected: number
    membersPaid: number
    membersOutstanding: number
    collectionRate: number
    outstandingMembers: { name: string; email: string; amount: number; daysOverdue: number }[]
    goalProgress: { name: string; target: number; current: number; progress: number } | null
    upcomingEvent: { title: string; startAt: string; location: string | null } | null
  }
  payout: {
    hasSchedule: boolean
    currentBeneficiary: { name: string; amount: number; dueDate: string } | null
    nextBeneficiary: { name: string; amount: number; dueDate: string } | null
    myPosition: number | null
    totalCycles: number
    completedCycles: number
    readiness: string
    schedule: { name: string; status: string; amount: number; order: number }[]
    previousPayout: { name: string; amount: number; completedAt: string | null } | null
  }
  contributionProgress: {
    member: { id: string; name: string; email: string; image: string | null }
    expected: number
    paid: number
    outstanding: number
    status: string
    proofStatus: string | null
  }[]
  alerts: { type: string; title: string; message: string; severity: "info" | "warning" | "error" }[]
  permissions: {
    canSubmitOwn: boolean
    canViewAll: boolean
    canReview: boolean
    canManageSchedule: boolean
    canManageEvents: boolean
    canManagePolls: boolean
    canManageGoals: boolean
    canManagePayouts: boolean
    canViewReports: boolean
    canViewPermissions: boolean
  }
}

export async function getStokvelDashboard(circleId: string, userId: string): Promise<StokvelDashboardData> {
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    include: { _count: { select: { members: true } } },
  })
  if (!circle || circle.type !== "STOKVEL") throw new Error("Not a stokvel circle")

  const settings = (circle.settings as Record<string, unknown>) ?? {}
  const contributionAmount = Number(settings.contributionAmount || 0)
  const memberCount = circle._count.members

  const [
    canSubmitOwn,
    canViewAll,
    canReview,
    canManageSchedule,
    canManageEvents,
    canManagePolls,
    canManageGoals,
    canManagePayouts,
    canViewReports,
    canViewPermissions,
  ] = await Promise.all([
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.SCHEDULE_MANAGE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.EVENT_MANAGE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.POLL_MANAGE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOAL_CREATE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.PAYOUT_APPROVE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.REPORT_VIEW }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_AUDIT_VIEW }),
  ])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    allMembers,
    myContributions,
    myScheduled,
    allContributionsThisMonth,
    compliance,
    payoutSchedule,
    nextPayout,
    goals,
    goalStats,
    events,
    myNotifications,
    myPayoutCycle,
    completedPayoutCount,
  ] = await Promise.all([
    prisma.circleMember.findMany({
      where: { circleId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.contribution.findMany({
      where: { userId, circleId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.contribution.findMany({
      where: { userId, circleId, scheduleId: { not: null }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.contribution.findMany({
      where: { circleId, createdAt: { gte: monthStart }, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
    getPoolCompliance(circleId),
    getPayoutSchedule(circleId),
    getNextPayout(circleId),
    getGoals(circleId, userId).catch(() => []),
    getGoalStats(circleId, userId).catch(() => null),
    getCircleEvents(circleId).catch(() => []),
    getUserNotifications(userId).catch(() => []),
    prisma.payoutCycle.findFirst({
      where: { circleId, recipientId: userId, status: { in: ["UPCOMING", "READY"] } },
      orderBy: { cycleNumber: "asc" },
    }),
    prisma.payoutCycle.count({ where: { circleId, status: "COMPLETED" } }),
  ])

  const paidMemberIds = new Set(allContributionsThisMonth.map((c) => c.userId))
  const membersPaid = allMembers.filter((m) => paidMemberIds.has(m.userId)).length
  const membersOutstanding = memberCount - membersPaid
  const expectedPool = contributionAmount * memberCount
  const collected = allContributionsThisMonth.reduce((sum, c) => sum + Number(c.amount), 0)
  const collectionRate = expectedPool > 0 ? Math.round((collected / expectedPool) * 100) : 0

  const myThisMonth = allContributionsThisMonth.find((c) => c.userId === userId)
  const myTotalPaid = myContributions
    .filter((c) => c.status === "PAID" || c.status === "CONFIRMED")
    .reduce((sum, c) => sum + Number(c.amount), 0)

  const myScheduledDues = myScheduled
    .filter((c) => c.status === "DUE" || c.status === "OVERDUE" || c.status === "UPCOMING")
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())

  const nextDue = myScheduledDues[0] ?? null
  let daysRemaining: number | null = null
  let nextDueDate: string | null = null
  if (nextDue?.dueDate) {
    const due = new Date(nextDue.dueDate)
    nextDueDate = due.toISOString()
    daysRemaining = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  }

  const outstandingAmount = myScheduledDues
    .filter((c) => c.status === "DUE" || c.status === "OVERDUE")
    .reduce((sum, c) => sum + Number(c.amount) + (c.lateFeeAmount ? Number(c.lateFeeAmount) : 0), 0)

  let paymentStreak = 0
  const monthChecks = new Map<string, boolean>()
  for (const c of myContributions) {
    if (c.status === "PAID" || c.status === "CONFIRMED") {
      const d = new Date(c.paymentDate || c.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      monthChecks.set(key, true)
    }
  }
  const currentMonth = now.getFullYear() * 12 + now.getMonth()
  for (let i = 0; i < 24; i++) {
    const checkMonth = currentMonth - i
    const y = Math.floor(checkMonth / 12)
    const m = checkMonth % 12
    if (monthChecks.has(`${y}-${m}`)) paymentStreak++
    else break
  }

  const outstandingMembers = allMembers
    .filter((m) => !paidMemberIds.has(m.userId))
    .map((m) => {
      const overdue = myScheduled.filter(
        (c) => c.userId === m.userId && c.status === "OVERDUE"
      )
      const daysOverdue = overdue.length > 0
        ? Math.max(...overdue.map((c) =>
            c.dueDate ? Math.max(0, Math.ceil((now.getTime() - new Date(c.dueDate).getTime()) / 86400000)) : 0
          ))
        : 0
      return {
        name: m.user.name || m.user.email,
        email: m.user.email,
        amount: contributionAmount,
        daysOverdue,
      }
    })

  const activeGoal = goals.find((g: any) => g.status === "ACTIVE") ?? goals[0] ?? null
  const goalProgress = activeGoal
    ? {
        name: activeGoal.name,
        target: Number(activeGoal.targetAmount),
        current: Number(activeGoal.currentAmount),
        progress: activeGoal.progress ?? 0,
      }
    : null

  const upcomingEvent = events.find((e: any) => new Date(e.startAt) > now) ?? null
  const formattedEvent = upcomingEvent
    ? { title: upcomingEvent.title, startAt: upcomingEvent.startAt?.toISOString?.() ?? String(upcomingEvent.startAt), location: (upcomingEvent as any).location ?? null }
    : null

  const contributionProgress = allMembers.map((m) => {
    const memberContribs = allContributionsThisMonth.filter((c) => c.userId === m.userId)
    const paid = memberContribs.reduce((sum, c) => sum + Number(c.amount), 0)
    const proofContrib = memberContribs.find((c) => c.verificationStatus)
    return {
      member: { id: m.user.id, name: m.user.name || m.user.email, email: m.user.email, image: m.user.image },
      expected: contributionAmount,
      paid,
      outstanding: Math.max(0, contributionAmount - paid),
      status: paid >= contributionAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
      proofStatus: proofContrib?.verificationStatus ?? null,
    }
  })

  const totalCycles = payoutSchedule.length
  const completedCycles = payoutSchedule.filter((p) => p.status === "COMPLETED").length

  let payoutPosition: number | null = null
  let payoutAmount: number | null = null
  let payoutDate: string | null = null
  if (myPayoutCycle) {
    payoutPosition = myPayoutCycle.cycleNumber
    payoutAmount = Number(myPayoutCycle.amount)
    payoutDate = myPayoutCycle.dueDate?.toISOString() ?? null
  }

  const alerts: StokvelDashboardData["alerts"] = []
  if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3) {
    alerts.push({ type: "PAYMENT_DUE_SOON", title: "Payment due soon", message: `Your contribution of R${contributionAmount.toLocaleString()} is due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`, severity: "warning" })
  }
  if (outstandingAmount > 0) {
    alerts.push({ type: "PAYMENT_OVERDUE", title: "Payment overdue", message: `You have R${outstandingAmount.toLocaleString()} outstanding`, severity: "error" })
  }
  const awaitingReview = myContributions.filter((c) => c.verificationStatus === "NEEDS_REVIEW")
  if (awaitingReview.length > 0) {
    alerts.push({ type: "PROOF_AWAITING_REVIEW", title: "Proof awaiting review", message: `${awaitingReview.length} proof payment${awaitingReview.length > 1 ? "s" : ""} awaiting review`, severity: "info" })
  }
  const rejectedProofs = myContributions.filter((c) => c.verificationStatus === "REJECTED")
  if (rejectedProofs.length > 0) {
    alerts.push({ type: "PROOF_REJECTED", title: "Proof rejected", message: `${rejectedProofs.length} proof payment${rejectedProofs.length > 1 ? "s" : ""} rejected`, severity: "error" })
  }
  if (formattedEvent) {
    const eventDate = new Date(formattedEvent.startAt)
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / 86400000)
    if (daysUntil <= 7 && daysUntil >= 0) {
      alerts.push({ type: "UPCOMING_MEETING", title: "Upcoming meeting", message: `"${formattedEvent.title}" in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`, severity: "info" })
    }
  }
  if (nextPayout?.dueDate) {
    const payoutDue = new Date(nextPayout.dueDate)
    const daysUntilPayout = Math.ceil((payoutDue.getTime() - now.getTime()) / 86400000)
    if (daysUntilPayout <= 7 && daysUntilPayout >= 0) {
      alerts.push({ type: "UPCOMING_PAYOUT", title: "Upcoming payout", message: `Next payout to ${nextPayout.recipient?.name ?? "member"} in ${daysUntilPayout} day${daysUntilPayout === 1 ? "" : "s"}`, severity: "info" })
    }
  }

  const schedule = payoutSchedule.map((p) => ({
    name: p.recipient?.name ?? "—",
    status: p.status,
    amount: Number(p.amount),
    order: p.cycleNumber,
  }))

  const currentBeneficiary = payoutSchedule.find((p) => p.status === "READY" || p.status === "UPCOMING")
  const nextInLine = payoutSchedule.find((p) => p.status === "UPCOMING" && p.cycleNumber > (currentBeneficiary?.cycleNumber ?? 0))

  return {
    circle: {
      id: circleId,
      name: circle.name,
      currency: circle.currency,
      memberCount,
      settings,
    },
    my: {
      monthlyContribution: contributionAmount,
      contributionStatus: myThisMonth?.status ?? "NONE",
      nextDueDate,
      daysRemaining,
      totalContributed: myTotalPaid,
      outstandingAmount,
      paymentStreak,
      payoutPosition,
      payoutAmount,
      payoutDate,
      proofStatus: myThisMonth?.verificationStatus ?? null,
    },
    group: {
      expectedPool,
      collected,
      membersPaid,
      membersOutstanding,
      collectionRate,
      outstandingMembers,
      goalProgress,
      upcomingEvent: formattedEvent,
    },
    payout: {
      hasSchedule: totalCycles > 0,
      currentBeneficiary: currentBeneficiary
        ? { name: currentBeneficiary.recipient?.name ?? "—", amount: Number(currentBeneficiary.amount), dueDate: currentBeneficiary.dueDate?.toISOString?.() ?? "" }
        : null,
      nextBeneficiary: nextInLine
        ? { name: nextInLine.recipient?.name ?? "—", amount: Number(nextInLine.amount), dueDate: nextInLine.dueDate?.toISOString?.() ?? "" }
        : null,
      myPosition: myPayoutCycle?.cycleNumber ?? null,
      totalCycles,
      completedCycles,
      readiness: completedCycles >= totalCycles && totalCycles > 0 ? "COMPLETE" : completedCycles > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      schedule,
      previousPayout: completedCycles > 0
        ? (() => {
            const prev = payoutSchedule.filter((p) => p.status === "COMPLETED").pop()
            return prev ? { name: prev.recipient?.name ?? "—", amount: Number(prev.amount), completedAt: prev.completedAt?.toISOString?.() ?? null } : null
          })()
        : null,
    },
    contributionProgress,
    alerts,
    permissions: {
      canSubmitOwn,
      canViewAll,
      canReview,
      canManageSchedule,
      canManageEvents,
      canManagePolls,
      canManageGoals,
      canManagePayouts,
      canViewReports,
      canViewPermissions,
    },
  }
}
