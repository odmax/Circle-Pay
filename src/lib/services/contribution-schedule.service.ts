import { prisma } from "@/lib/prisma"
import { hasCirclePermission, requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification, createBulkNotifications, notifyCircleMembers } from "@/lib/services/notification.service"
import { detectAndRecordContributionScheduleConflicts } from "@/lib/services/constitution-rules.service"

export type ScheduleFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "CUSTOM"

export interface ScheduleInput {
  name?: string
  amount: number
  frequency: ScheduleFrequency
  firstDueDate: string
  dueDay?: number | null
  gracePeriodDays?: number
  lateFee?: number | null
  autoGenerate?: boolean
  isActive?: boolean
}

const FREQUENCY_DAYS: Record<ScheduleFrequency, number> = {
  WEEKLY: 7,
  FORTNIGHTLY: 14,
  MONTHLY: 30,
  QUARTERLY: 91,
  ANNUALLY: 365,
  CUSTOM: 30,
}

export function startOfDay(d: Date | string): Date {
  const date = d instanceof Date ? d : new Date(d)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function nextPeriodDate(current: Date, frequency: ScheduleFrequency): Date {
  const base = new Date(current)
  switch (frequency) {
    case "WEEKLY":
      return addDays(base, 7)
    case "FORTNIGHTLY":
      return addDays(base, 14)
    case "MONTHLY":
      return new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
    case "QUARTERLY":
      return new Date(base.getFullYear(), base.getMonth() + 3, base.getDate())
    case "ANNUALLY":
      return new Date(base.getFullYear() + 1, base.getMonth(), base.getDate())
    case "CUSTOM":
      return addDays(base, 30)
  }
}

export function formatPeriodLabel(d: Date, frequency: ScheduleFrequency): string {
  if (frequency === "WEEKLY") {
    const year = d.getFullYear()
    const start = new Date(d)
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
    const week = Math.ceil((start.getTime() - new Date(year, 0, 1).getTime()) / (7 * 86400000))
    return `${year}-W${week}`
  }
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return frequency === "MONTHLY" ? `${d.getFullYear()}-${mm}` : `${d.getFullYear()}-${mm}-${dd}`
}

export async function getContributionSchedules(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.SCHEDULE_VIEW })

  const schedules = await prisma.contributionSchedule.findMany({
    where: { circleId, deletedAt: null },
    include: {
      _count: { select: { contributions: true } },
    },
    orderBy: [{ isActive: "desc" }, { firstDueDate: "asc" }],
  })

  return schedules.map((s) => ({
    ...s,
    amount: Number(s.amount),
    lateFee: s.lateFee != null ? Number(s.lateFee) : null,
  }))
}

export async function createContributionSchedule(circleId: string, userId: string, data: ScheduleInput) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.SCHEDULE_MANAGE })

  const firstDueDate = new Date(data.firstDueDate)
  const schedule = await prisma.contributionSchedule.create({
    data: {
      circleId,
      name: data.name?.trim() || "Contribution Schedule",
      amount: data.amount,
      frequency: data.frequency,
      firstDueDate,
      dueDay: data.dueDay || null,
      gracePeriodDays: data.gracePeriodDays ?? 0,
      lateFee: data.lateFee ?? null,
      autoGenerate: data.autoGenerate ?? true,
      isActive: data.isActive ?? true,
      nextDueDate: firstDueDate,
      createdById: userId,
    },
  })

  createAuditLog({
    userId,
    circleId,
    action: "SCHEDULE_CREATED",
    entityType: "ContributionSchedule",
    entityId: schedule.id,
    newValues: { name: schedule.name, amount: Number(schedule.amount), frequency: schedule.frequency, firstDueDate: schedule.firstDueDate.toISOString(), gracePeriodDays: schedule.gracePeriodDays },
  }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "CONTRIBUTION_PLAN_CREATED",
    title: "New contribution schedule",
    message: `A new schedule of ${Number(schedule.amount)} has been created`,
    link: `/circles/${circleId}/contributions`,
  }).catch(() => {})

  await detectAndRecordContributionScheduleConflicts(
    circleId,
    {
      id: schedule.id,
      amount: Number(schedule.amount),
      frequency: schedule.frequency,
      dueDay: schedule.dueDay == null ? null : Number(schedule.dueDay),
      gracePeriodDays: schedule.gracePeriodDays == null ? null : Number(schedule.gracePeriodDays),
      lateFee: schedule.lateFee == null ? null : Number(schedule.lateFee),
    },
    userId
  ).catch(() => {})

  return schedule
}

export async function updateContributionSchedule(circleId: string, scheduleId: string, userId: string, data: Partial<ScheduleInput>) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.SCHEDULE_MANAGE })

  const existing = await prisma.contributionSchedule.findFirst({ where: { id: scheduleId, circleId } })
  if (!existing) throw new Error("Schedule not found")

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name.trim() || "Contribution Schedule"
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.frequency !== undefined) updateData.frequency = data.frequency
  if (data.firstDueDate !== undefined) updateData.firstDueDate = new Date(data.firstDueDate)
  if (data.dueDay !== undefined) updateData.dueDay = data.dueDay || null
  if (data.gracePeriodDays !== undefined) updateData.gracePeriodDays = data.gracePeriodDays ?? 0
  if (data.lateFee !== undefined) updateData.lateFee = data.lateFee ?? null
  if (data.autoGenerate !== undefined) updateData.autoGenerate = data.autoGenerate
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const schedule = await prisma.contributionSchedule.update({
    where: { id: scheduleId },
    data: updateData,
  })

  createAuditLog({
    userId,
    circleId,
    action: "SCHEDULE_UPDATED",
    entityType: "ContributionSchedule",
    entityId: schedule.id,
    newValues: updateData,
  }).catch(() => {})

  await detectAndRecordContributionScheduleConflicts(
    circleId,
    {
      id: schedule.id,
      amount: Number(schedule.amount),
      frequency: schedule.frequency,
      dueDay: schedule.dueDay == null ? null : Number(schedule.dueDay),
      gracePeriodDays: schedule.gracePeriodDays == null ? null : Number(schedule.gracePeriodDays),
      lateFee: schedule.lateFee == null ? null : Number(schedule.lateFee),
    },
    userId
  ).catch(() => {})

  return schedule
}

export async function deleteContributionSchedule(circleId: string, scheduleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.SCHEDULE_MANAGE })

  const existing = await prisma.contributionSchedule.findFirst({ where: { id: scheduleId, circleId } })
  if (!existing) throw new Error("Schedule not found")

  const schedule = await prisma.contributionSchedule.update({
    where: { id: scheduleId },
    data: { isActive: false, deletedAt: new Date() },
  })

  // Cancel any unfulfilled upcoming/due records generated by this schedule
  await prisma.contribution.updateMany({
    where: { scheduleId, status: { in: ["UPCOMING", "DUE"] } },
    data: { status: "CANCELLED" },
  })

  createAuditLog({
    userId,
    circleId,
    action: "SCHEDULE_DELETED",
    entityType: "ContributionSchedule",
    entityId: schedule.id,
    newValues: { isActive: false, deletedAt: new Date().toISOString() },
  }).catch(() => {})

  return { success: true }
}

export async function generateScheduledContributions(now: Date = new Date()): Promise<number> {
  const schedules = await prisma.contributionSchedule.findMany({
    where: { isActive: true, autoGenerate: true, deletedAt: null },
    include: { circle: { select: { id: true } } },
  })

  let totalGenerated = 0
  const horizon = addDays(now, 183)

  for (const schedule of schedules) {
    const anchor = schedule.nextDueDate ?? schedule.firstDueDate
    if (!anchor) continue

    const members = await prisma.circleMember.findMany({
      where: { circleId: schedule.circleId },
      select: { userId: true },
    })
    if (members.length === 0) continue

    const periodStart = startOfDay(anchor)
    const end = startOfDay(horizon)
    let cursor = periodStart
    let lastPeriod: Date | null = null
    let guard = 0

    while (cursor <= end && guard < 200) {
      const periodLabel = formatPeriodLabel(cursor, schedule.frequency)
      for (const m of members) {
        const existing = await prisma.contribution.findFirst({
          where: { circleId: schedule.circleId, scheduleId: schedule.id, userId: m.userId, periodLabel },
          select: { id: true },
        })
        if (existing) continue
        await prisma.contribution.create({
          data: {
            circleId: schedule.circleId,
            userId: m.userId,
            amount: schedule.amount,
            status: "UPCOMING",
            paymentDate: cursor,
            dueDate: cursor,
            periodLabel,
            contributionMonth: schedule.frequency === "MONTHLY" ? periodLabel : null,
            scheduleId: schedule.id,
            gracePeriodDays: schedule.gracePeriodDays,
            lateFeeAmount: schedule.lateFee,
            createdById: schedule.createdById,
            note: `Auto-generated from schedule: ${schedule.name}`,
          },
        })
        totalGenerated++
      }
      lastPeriod = cursor
      cursor = nextPeriodDate(cursor, schedule.frequency)
      guard++
    }

    await prisma.contributionSchedule.update({
      where: { id: schedule.id },
      data: { lastGeneratedAt: now, nextDueDate: lastPeriod ?? anchor },
    })

    createAuditLog({
      userId: schedule.createdById,
      circleId: schedule.circleId,
      action: "CONTRIBUTIONS_GENERATED",
      entityType: "ContributionSchedule",
      entityId: schedule.id,
      newValues: { generated: totalGenerated, through: lastPeriod ? lastPeriod.toISOString() : null },
    }).catch(() => {})
  }

  return totalGenerated
}

export async function promoteDueContributions(now: Date = new Date()): Promise<number> {
  const res = await prisma.contribution.updateMany({
    where: { status: "UPCOMING", deletedAt: null, dueDate: { lte: now } },
    data: { status: "DUE" },
  })
  return res.count
}

const REMINDER_STAGES = ["7_DAYS", "3_DAYS", "1_DAY", "DUE"] as const

function reminderStageFor(daysUntilDue: number): (typeof REMINDER_STAGES)[number] | null {
  if (daysUntilDue === 7) return "7_DAYS"
  if (daysUntilDue === 3) return "3_DAYS"
  if (daysUntilDue === 1) return "1_DAY"
  if (daysUntilDue === 0) return "DUE"
  return null
}

export async function sendContributionReminders(now: Date = new Date()): Promise<number> {
  const contributions = await prisma.contribution.findMany({
    where: {
      scheduleId: { not: null },
      deletedAt: null,
      status: { in: ["UPCOMING", "DUE", "PROOF_SUBMITTED", "PENDING_REVIEW"] },
      dueDate: { not: null },
    },
    include: {
      schedule: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  const today = startOfDay(now)
  let sent = 0

  for (const c of contributions) {
    if (!c.dueDate) continue
    const due = startOfDay(c.dueDate)
    const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86400000)
    const stage = reminderStageFor(daysUntilDue)
    if (!stage) continue

    const existing = await prisma.contributionReminder.findUnique({
      where: { contributionId_stage: { contributionId: c.id, stage } },
      select: { id: true },
    })
    if (existing) continue

    await prisma.contributionReminder.create({
      data: { contributionId: c.id, stage },
    })

    const name = c.user.name || c.user.email || "your"
    const amount = Number(c.amount)
    const labels: Record<string, string> = {
      "7_DAYS": "7 days until your contribution is due",
      "3_DAYS": "3 days until your contribution is due",
      "1_DAY": "Your contribution is due tomorrow",
      DUE: "Your contribution is due today",
    }

    await createNotification({
      userId: c.userId,
      circleId: c.circleId,
      type: "CONTRIBUTION_REMINDER",
      title: labels[stage],
      message: `${name}, a contribution of ${amount} is due on ${due.toLocaleDateString()} (${c.schedule?.name ?? "schedule"}).`,
      link: `/circles/${c.circleId}/contributions`,
    })

    createAuditLog({
      userId: null,
      circleId: c.circleId,
      action: "REMINDER_SENT",
      entityType: "Contribution",
      entityId: c.id,
      newValues: { stage, dueDate: c.dueDate.toISOString() },
    }).catch(() => {})

    sent++
  }

  return sent
}

export async function sweepOverdueContributions(now: Date = new Date()): Promise<number> {
  const candidates = await prisma.contribution.findMany({
    where: {
      scheduleId: { not: null },
      deletedAt: null,
      status: { in: ["UPCOMING", "DUE"] },
      dueDate: { not: null },
    },
    include: {
      schedule: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  const today = startOfDay(now)
  let overdue = 0

  for (const c of candidates) {
    if (!c.dueDate) continue
    const cutoff = addDays(startOfDay(c.dueDate), c.gracePeriodDays + 1)
    if (today < cutoff) continue

    const lateFeeApplied = c.lateFeeAmount != null && Number(c.lateFeeAmount) > 0
    await prisma.contribution.update({
      where: { id: c.id },
      data: {
        status: "OVERDUE",
        overdueAt: now,
        lateFeeApplied,
      },
    })

    const name = c.user.name || c.user.email || "a member"
    const amount = Number(c.amount)
    const daysOverdue = Math.round((today.getTime() - cutoff.getTime()) / 86400000) + 1
    const feeText = lateFeeApplied ? ` A late fee of ${Number(c.lateFeeAmount)} applies.` : ""

    await createNotification({
      userId: c.userId,
      circleId: c.circleId,
      type: "CONTRIBUTION_REMINDER",
      title: "Contribution is overdue",
      message: `${name}, your contribution of ${amount} is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue.${feeText}`,
      link: `/circles/${c.circleId}/contributions`,
    })

    // Notify circle owners/admins
    const admins = await prisma.circleMember.findMany({
      where: { circleId: c.circleId, role: { in: ["OWNER", "ADMIN"] }, NOT: { userId: c.userId } },
      select: { userId: true },
    })
    if (admins.length > 0) {
      await createBulkNotifications(
        admins.map((a) => ({
          userId: a.userId,
          circleId: c.circleId,
          type: "CONTRIBUTION_REMINDER",
          title: "Overdue contribution",
          message: `${name} has an overdue contribution of ${amount} (${c.schedule?.name ?? "schedule"}).${feeText}`,
          link: `/circles/${c.circleId}/contributions`,
        })),
      )
    }

    createAuditLog({
      userId: null,
      circleId: c.circleId,
      action: "CONTRIBUTION_OVERDUE",
      entityType: "Contribution",
      entityId: c.id,
      newValues: { overdueAt: now.toISOString(), daysOverdue, lateFeeApplied, lateFee: c.lateFeeAmount ? Number(c.lateFeeAmount) : null },
    }).catch(() => {})

    overdue++
  }

  return overdue
}

export async function acknowledgeContributionReminder(circleId: string, contributionId: string, userId: string) {
  const contribution = await prisma.contribution.findFirst({ where: { id: contributionId, circleId } })
  if (!contribution) throw new Error("Contribution not found")

  const isOwner = contribution.userId === userId
  const canReview = await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW })
  if (!isOwner && !canReview) throw new Error("Forbidden")

  await prisma.contribution.update({
    where: { id: contributionId },
    data: { acknowledgedAt: new Date() },
  })

  createAuditLog({
    userId,
    circleId,
    action: "REMINDER_ACKNOWLEDGED",
    entityType: "Contribution",
    entityId: contributionId,
    newValues: { acknowledgedAt: new Date().toISOString() },
  }).catch(() => {})

  return { success: true }
}

export async function runContributionJobs(now: Date = new Date()): Promise<{
  generated: number
  promoted: number
  reminders: number
  overdue: number
}> {
  const generated = await generateScheduledContributions(now)
  const promoted = await promoteDueContributions(now)
  const reminders = await sendContributionReminders(now)
  const overdue = await sweepOverdueContributions(now)
  return { generated, promoted, reminders, overdue }
}
