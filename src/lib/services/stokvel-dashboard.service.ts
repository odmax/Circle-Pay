import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getPayoutQueue } from "@/lib/services/payout-rotation.service"
import { getContributionSchedules } from "@/lib/services/contribution-schedule.service"
import { getGoals, getGoalStats } from "@/lib/services/goal.service"
import { getCircleEvents } from "@/lib/services/event.service"
import { getUserNotifications } from "@/lib/services/notification.service"
import { getConstitutionOverview } from "@/lib/services/constitution.service"
import type { LoanRepaymentStatus } from "@/generated/prisma/enums"

/**
 * Minimal view of a payout queue entry consumed by the stokvel dashboard.
 * Produced by the shared payout rotation engine (getPayoutQueue) so the
 * dashboard can never disagree with /circles/[circleId]/payouts.
 */
export interface PayoutQueueItemView {
  id?: string
  cycleNumber: number
  amount: number
  status: string
  dueDate: Date | null
  readiness?: string | null
  confirmedAt?: Date | null
  paidAt?: Date | null
  completedAt?: Date | null
  recipient?: { name?: string | null; email?: string | null } | null
}

export interface MyCycleView {
  cycleNumber: number
  status: string
  amount: number | null
  dueDate: Date | null
}

const PAYOUT_ACTIVE = ["UPCOMING", "READY", "BLOCKED", "PENDING_APPROVAL", "APPROVED"]
const PAYOUT_DONE = ["COMPLETED", "CONFIRMED_RECEIVED", "PAID"]

/**
 * Derives the dashboard payout summary strictly from the payout rotation
 * engine's queue, so current/next beneficiary, position, readiness, blockers
 * and progress are always consistent with the payout queue page.
 */
export function buildPayoutBlock(input: {
  queue: PayoutQueueItemView[]
  myCycle: MyCycleView | null
}): StokvelDashboardData["payout"] {
  const { queue, myCycle } = input
  const totalCycles = queue.length
  const completedCycles = queue.filter((c) => PAYOUT_DONE.includes(c.status)).length
  const hasSchedule = totalCycles > 0

  const currentIdx = queue.findIndex((c) => PAYOUT_ACTIVE.includes(c.status))
  const currentCycle = currentIdx === -1 ? null : queue[currentIdx]
  const nextCycle =
    currentCycle !== null
      ? queue.slice(currentIdx + 1).find((c) => PAYOUT_ACTIVE.includes(c.status)) ?? null
      : null

  const nameOf = (c: PayoutQueueItemView): string =>
    c.recipient?.name || c.recipient?.email || "—"
  const dateOf = (d: Date | null | undefined): string =>
    d ? new Date(d).toISOString() : ""

  const completedCycle = queue.filter((c) => PAYOUT_DONE.includes(c.status)).pop() ?? null

  let readiness = "NOT_STARTED"
  let blockers: string[] = []
  if (totalCycles > 0) {
    if (currentCycle) {
      if (currentCycle.status === "BLOCKED") {
        readiness = "BLOCKED"
        blockers = (currentCycle.readiness || "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
      } else {
        readiness = currentCycle.readiness || currentCycle.status
      }
    } else if (completedCycles >= totalCycles) {
      readiness = "COMPLETE"
    } else {
      readiness = "IN_PROGRESS"
    }
  }

  return {
    hasSchedule,
    currentBeneficiary: currentCycle
      ? {
          name: nameOf(currentCycle),
          amount: currentCycle.amount,
          dueDate: dateOf(currentCycle.dueDate),
          status: currentCycle.status,
          readiness: readiness,
        }
      : null,
    nextBeneficiary: nextCycle
      ? { name: nameOf(nextCycle), amount: nextCycle.amount, dueDate: dateOf(nextCycle.dueDate) }
      : null,
    myPosition: myCycle?.cycleNumber ?? null,
    totalCycles,
    completedCycles,
    readiness,
    blockers,
    schedule: queue.map((c) => ({
      name: nameOf(c),
      status: c.status,
      amount: c.amount,
      order: c.cycleNumber,
    })),
    previousPayout: completedCycle
      ? {
          name: nameOf(completedCycle),
          amount: completedCycle.amount,
          completedAt: dateOf(completedCycle.completedAt ?? completedCycle.paidAt ?? completedCycle.confirmedAt) || null,
        }
      : null,
  }
}

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
    currentBeneficiary: { name: string; amount: number; dueDate: string; status?: string; readiness?: string } | null
    nextBeneficiary: { name: string; amount: number; dueDate: string } | null
    myPosition: number | null
    totalCycles: number
    completedCycles: number
    readiness: string
    blockers: string[]
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
  constitution: {
    exists: boolean
    activeVersion: number | null
    status: string | null
    accepted: boolean
    acceptancePercent: number
    conflictCount: number
  }
  governance: {
    nextMeeting: {
      id: string
      title: string
      scheduledAt: string | null
      status: string
      countdownDays: number | null
    } | null
    myRSVP: string | null
    quorum: {
      required: number | null
      present: number
      quorumPercent: number | null
      reached: boolean
    } | null
    openVotes: { id: string; title: string; closesAt: string | null; anonymous: boolean }[]
    pendingDecisions: { id: string; title: string; outcome: string }[]
    latestMinutes: { id: string; status: string; publishedAt: string | null } | null
  }
  yearEnd: {
    hasClose: boolean
    status: string | null
    statusIndex: number
    totalSteps: number
    periodStart: string | null
    periodEnd: string | null
    finalizedAt: string | null
    statementsGenerated: number
    myStatement: {
      statementNumber: string
      periodStart: string
      periodEnd: string
      totalContributed: string
      finalEntitlement: string
    } | null
    blockerCodes: string[]
    clear: boolean
  }
  loan: {
    enabled: boolean
    canApply: boolean
    myActiveLoans: number
    myPendingReview: number
    nextRepayment: {
      amount: number
      dueDate: string
      status: string
      periodNumber: number
      loanId: string
    } | null
    outstandingBalance: number
    overdue: boolean
    defaulted: boolean
    totalLoansOutstanding: number
    pendingApplications: number
    repaymentRate: number
    latestStatus: string | null
  }
  grocery: {
    enabled: boolean
    hasCampaign: boolean
    activeCampaign: {
      id: string
      name: string
      status: string
      targetPercent: number
      amountCollected: number
      targetAmount: number
    } | null
  }
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
    canViewConstitution: boolean
    canViewMeetings: boolean
    canVote: boolean
    canManageMeetings: boolean
    canViewYearEnd: boolean
    canViewLoans: boolean
    canReviewLoans: boolean
    canApplyLoans: boolean
    canViewGrocery: boolean
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
    canViewConstitution,
    canViewMeetings,
    canVote,
    canManageMeetings,
    canViewYearEnd,
    canViewLoans,
    canReviewLoans,
    canApplyLoans,
    canViewGrocery,
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
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONSTITUTION_VIEW }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_VIEW }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_VIEW_OWN }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LOAN_APPLY }),
    hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_OWN }),
  ])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    allMembers,
    myContributions,
    myScheduled,
    allContributionsThisMonth,
    queueData,
    goals,
    goalStats,
    events,
    myNotifications,
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
    getPayoutQueue(circleId, userId),
    getGoals(circleId, userId).catch(() => []),
    getGoalStats(circleId, userId).catch(() => null),
    getCircleEvents(circleId).catch(() => []),
    getUserNotifications(userId).catch(() => []),
  ])

  // Governance / meetings integration feed.
  const [nextMeeting, myRsvp, openVotes, pendingDecisions, latestMinutes, meetingQuorum] = await Promise.all([
    prisma.meeting.findFirst({
      where: { circleId, deletedAt: null, status: { in: ["SCHEDULED", "DRAFT"] } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.meetingRSVP.findMany({
      where: {
        meeting: { circleId, deletedAt: null, status: { in: ["SCHEDULED", "DRAFT"] } },
        userId,
      },
      select: { status: true, meeting: { select: { id: true, scheduledAt: true } } },
      orderBy: { meeting: { scheduledAt: "asc" } },
    }),
    prisma.governanceVote.findMany({
      where: { circleId, status: "OPEN" },
      select: { id: true, title: true, closesAt: true, anonymous: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.governanceDecision.findMany({
      where: { circleId, outcome: "APPROVED" },
      select: { id: true, title: true, outcome: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.meetingMinutes.findFirst({
      where: { meeting: { circleId }, status: "PUBLISHED" },
      select: { id: true, status: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.meetingAttendance.findMany({ where: { meeting: { circleId } } }),
  ])

  // Loan widget data. Only surfaced when the user can view loans at all.
  const canSeeLoans = canViewLoans || canReviewLoans
  const [loanConfig, myLoans, allLoans] = canSeeLoans
    ? await Promise.all([
        prisma.circleLoanConfig.findUnique({ where: { circleId } }),
        prisma.loan.findMany({
          where: { circleId, memberId: userId },
          orderBy: { createdAt: "desc" },
        }),
        (canReviewLoans || canViewLoans)
          ? prisma.loan.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 500 })
          : Promise.resolve([]),
      ])
    : [null, [], []]

  const loanActiveStatuses = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "DISBURSED", "REPAYING", "OVERDUE"]
  const loanRepaymentActiveStatuses: LoanRepaymentStatus[] = ["PENDING", "PROOF_SUBMITTED", "OVERDUE"]
  const loanEnabled = loanConfig?.enabled ?? false

  // My active loans (in a non-terminal state) — first is newest.
  const myActive = myLoans.filter((l) => loanActiveStatuses.includes(l.status))
  const myPendingReview = myLoans.filter((l) => l.status === "SUBMITTED" || l.status === "UNDER_REVIEW").length

  // Next repayment: earliest pending/overdue schedule across my active loans.
  const myActiveIds = myActive.map((l) => l.id)
  const myActiveSchedules =
    myActiveIds.length > 0
      ? await prisma.loanRepaymentSchedule.findMany({
          where: { loanId: { in: myActiveIds }, status: { in: loanRepaymentActiveStatuses } },
          orderBy: { dueDate: "asc" },
          take: 100,
        })
      : []

  // Outstanding balance = sum of unresolved schedule due amounts across my active loans.
  const outstandingBalance = myActiveSchedules
    .filter((s) => s.status === "PENDING" || s.status === "PROOF_SUBMITTED" || s.status === "OVERDUE")
    .reduce((sum, s) => sum + Number(s.totalDue) - Number(s.amountPaid), 0)

  const firstPending = myActiveSchedules[0] ?? null
  const nextRepayment = firstPending
    ? {
        amount: Math.max(0, Number(firstPending.totalDue) - Number(firstPending.amountPaid)),
        dueDate: firstPending.dueDate ? firstPending.dueDate.toISOString() : "",
        status: firstPending.status,
        periodNumber: firstPending.periodNumber,
        loanId: firstPending.loanId,
      }
    : null

  const myOverdue = myLoans.some((l) => l.status === "OVERDUE") || myActiveSchedules.some((s) => s.status === "OVERDUE")
  const myDefaulted = myLoans.some((l) => l.status === "DEFAULTED")

  // Portfolio summary (admin/treasurer only).
  let totalLoansOutstanding = 0
  let pendingApplications = 0
  let repaymentRate = 0
  if (canReviewLoans || canViewLoans) {
    totalLoansOutstanding = allLoans
      .filter((l) => ["APPROVED", "DISBURSED", "REPAYING", "OVERDUE"].includes(l.status))
      .reduce((sum, l) => sum + Number(l.principal), 0)
    pendingApplications = allLoans.filter((l) => l.status === "SUBMITTED" || l.status === "UNDER_REVIEW").length
    const withSchedule = await prisma.loanRepaymentSchedule.count({
      where: { circleId, loanId: { in: allLoans.map((l) => l.id) } },
    })
    const confirmedSchedules = await prisma.loanRepaymentSchedule.count({
      where: { circleId, loanId: { in: allLoans.map((l) => l.id) }, status: "CONFIRMED" },
    })
    repaymentRate = withSchedule > 0 ? Math.round((confirmedSchedules / withSchedule) * 100) : 0
  }

  const loanBlock: StokvelDashboardData["loan"] = {
    enabled: loanEnabled,
    canApply: canApplyLoans,
    myActiveLoans: myActive.length,
    myPendingReview,
    nextRepayment,
    outstandingBalance: Math.max(0, outstandingBalance),
    overdue: myOverdue,
    defaulted: myDefaulted,
    totalLoansOutstanding,
    pendingApplications,
    repaymentRate,
    latestStatus: myLoans[0]?.status ?? null,
  }

  // Grocery widget data. Only surfaced when the user can view grocery at all.
  let groceryBlock: StokvelDashboardData["grocery"] = { enabled: false, hasCampaign: false, activeCampaign: null }
  if (canViewGrocery) {
    const [groceryConfig, groceryCampaigns] = await Promise.all([
      prisma.circleGroceryConfig.findUnique({ where: { circleId } }),
      prisma.groceryCampaign.findMany({
        where: { circleId },
        orderBy: { createdAt: "desc" },
        include: { contributions: { where: { status: { in: ["PAID", "CONFIRMED"] } } } },
      }),
    ])
    const activeGrocery = groceryCampaigns.find((c) => ["ACTIVE", "PURCHASING", "DISTRIBUTING"].includes(c.status)) ?? null
    groceryBlock = {
      enabled: groceryConfig?.enabled ?? false,
      hasCampaign: groceryCampaigns.length > 0,
      activeCampaign: activeGrocery
        ? {
            id: activeGrocery.id,
            name: activeGrocery.name,
            status: activeGrocery.status,
            targetAmount: Number(activeGrocery.targetAmount),
            amountCollected: activeGrocery.contributions.reduce((s, x) => s + Number(x.amount), 0),
            targetPercent: Number(activeGrocery.targetAmount) > 0
              ? Math.round((activeGrocery.contributions.reduce((s, x) => s + Number(x.amount), 0) / Number(activeGrocery.targetAmount)) * 100)
              : 0,
          }
        : null,
    }
  }

  // Resolve the user's RSVP for the NEXT meeting only (not any other meeting).
  const myRSVP: string | null =
    (nextMeeting && myRsvp.find((r) => r.meeting.id === nextMeeting.id)?.status) ?? null

  const governance: StokvelDashboardData["governance"] = {
    nextMeeting: nextMeeting
      ? {
          id: nextMeeting.id,
          title: nextMeeting.title,
          scheduledAt: nextMeeting.scheduledAt ? nextMeeting.scheduledAt.toISOString() : null,
          status: nextMeeting.status,
          countdownDays: nextMeeting.scheduledAt
            ? Math.max(0, Math.ceil((new Date(nextMeeting.scheduledAt).getTime() - now.getTime()) / 86400000))
            : null,
        }
      : null,
    myRSVP,
    quorum: nextMeeting
      ? (() => {
          const present = meetingQuorum.filter((a) => a.status === "PRESENT" || a.status === "LATE").length
          const quorumPercent = nextMeeting.quorumPercent ?? null
          const required = quorumPercent == null ? null : Math.ceil((memberCount * quorumPercent) / 100)
          return {
            required,
            present,
            quorumPercent,
            reached: required == null ? false : present >= required,
          }
        })()
      : null,
    openVotes: openVotes.map((v) => ({ id: v.id, title: v.title, closesAt: v.closesAt ? v.closesAt.toISOString() : null, anonymous: v.anonymous })),
    pendingDecisions,
    latestMinutes: latestMinutes ? { id: latestMinutes.id, status: latestMinutes.status, publishedAt: latestMinutes.publishedAt ? latestMinutes.publishedAt.toISOString() : null } : null,
  }

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

  const payout = buildPayoutBlock({
    queue: queueData.queue,
    myCycle: queueData.myCycle,
  })

  const myPosition = payout.myPosition
  const myPayoutCycleAmount = myPosition !== null
    ? queueData.queue.find((c) => c.cycleNumber === myPosition && PAYOUT_ACTIVE.includes(c.status))?.amount ?? null
    : null
  const payoutAmount = myPayoutCycleAmount
  const payoutDate = myPosition !== null
    ? queueData.queue.find((c) => c.cycleNumber === myPosition)?.dueDate?.toISOString() ?? null
    : null

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
  if (payout.currentBeneficiary) {
    const payoutDue = new Date(payout.currentBeneficiary.dueDate)
    const daysUntilPayout = Math.ceil((payoutDue.getTime() - now.getTime()) / 86400000)
    if (daysUntilPayout <= 7 && daysUntilPayout >= 0) {
      alerts.push({ type: "UPCOMING_PAYOUT", title: "Upcoming payout", message: `Next payout to ${payout.currentBeneficiary.name} in ${daysUntilPayout} day${daysUntilPayout === 1 ? "" : "s"}`, severity: "info" })
    }
  }

  const overview = await getConstitutionOverview(circleId, userId)
  const full = "myAcceptance" in overview ? overview : null
  const constitution = {
    exists: overview.exists,
    activeVersion: overview.active?.version ?? null,
    status: overview.active?.status ?? null,
    accepted: !!full?.myAcceptance,
    acceptancePercent: full ? full.percentage : 0,
    conflictCount: full ? full.conflictCount : 0,
  }

  const yearEndStepOrder = ["DRAFT", "RECONCILING", "PENDING_APPROVAL", "APPROVED", "FINALIZED"] as const
  const [latestClose, myYearEndStatement] = canViewYearEnd
    ? await Promise.all([
        prisma.yearEndClose.findFirst({ where: { circleId }, orderBy: { periodEnd: "desc" } }),
        prisma.yearEndMemberStatement.findFirst({
          where: { circleId, userId, isCurrent: true },
          select: { statementNumber: true, periodStart: true, periodEnd: true, totalContributed: true, finalEntitlement: true },
        }),
      ])
    : [null, null]
  const yearEndBlockerJson = (latestClose?.blockers ?? null) as { blockers?: { code: string }[]; clear?: boolean } | null
  const yearEnd = {
    hasClose: !!latestClose,
    status: latestClose?.status ?? null,
    statusIndex: latestClose ? yearEndStepOrder.indexOf(latestClose.status as (typeof yearEndStepOrder)[number]) : -1,
    totalSteps: yearEndStepOrder.length,
    periodStart: latestClose?.periodStart ? latestClose.periodStart.toISOString() : null,
    periodEnd: latestClose?.periodEnd ? latestClose.periodEnd.toISOString() : null,
    finalizedAt: latestClose?.finalizedAt ? latestClose.finalizedAt.toISOString() : null,
    statementsGenerated: latestClose ? await prisma.yearEndMemberStatement.count({ where: { closeId: latestClose.id } }).catch(() => 0) : 0,
    myStatement: myYearEndStatement
      ? {
          statementNumber: myYearEndStatement.statementNumber,
          periodStart: myYearEndStatement.periodStart.toISOString(),
          periodEnd: myYearEndStatement.periodEnd.toISOString(),
          totalContributed: String(myYearEndStatement.totalContributed),
          finalEntitlement: String(myYearEndStatement.finalEntitlement),
        }
      : null,
    blockerCodes: (yearEndBlockerJson?.blockers ?? []).map((b) => b.code),
    clear: yearEndBlockerJson?.clear ?? true,
  }

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
      payoutPosition: myPosition,
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
    payout,
    contributionProgress,
    alerts,
    constitution,
    governance,
    yearEnd,
    loan: loanBlock,
    grocery: groceryBlock,
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
      canViewConstitution,
      canViewMeetings,
      canVote,
      canManageMeetings,
      canViewYearEnd,
      canViewLoans,
      canReviewLoans,
      canApplyLoans,
      canViewGrocery,
    },
  }
}
