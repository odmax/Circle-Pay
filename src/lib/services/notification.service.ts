import { prisma } from "@/lib/prisma"
import type { NotificationType } from "@/generated/prisma"

const DEFAULTS = { contributions: true, expenses: true, goals: true, wallet: true, events: true, approvals: true, members: true, receipts: true, projects: true, risks: true, ai: true }

const TYPE_TO_PREF: Record<string, string> = {
  CONTRIBUTION_MADE: "contributions", CONTRIBUTION_PLAN_CREATED: "contributions", CONTRIBUTION_REMINDER: "contributions",
  NEW_MEMBER_JOINED: "members",
  EXPENSE_ADDED: "expenses",
  GOAL_CREATED: "goals", GOAL_ALLOCATION_ADDED: "goals", GOAL_COMPLETED: "goals",
  SETTLEMENT_REQUESTED: "wallet", SETTLEMENT_CONFIRMED: "wallet", SETTLEMENT_REJECTED: "wallet",
  EVENT_REMINDER: "events",
  RECEIPT_ISSUED: "receipts", RECEIPT_VOIDED: "receipts", RECEIPT_REPLACED: "receipts",
  APPROVAL_ASSIGNED: "approvals", APPROVAL_STAGE_ACTIVATED: "approvals", APPROVAL_STAGE_COMPLETED: "approvals",
  APPROVAL_WORKFLOW_COMPLETED: "approvals", APPROVAL_DELEGATED: "approvals", APPROVAL_ESCALATED: "approvals",
  APPROVAL_OVERDUE: "approvals",
  PROJECT_CREATED: "projects",
  FINANCIAL_RISK: "risks",
  AI_INSIGHT: "ai",
}

async function isBlocked(userId: string, type: string): Promise<boolean> {
  const prefKey = TYPE_TO_PREF[type]
  if (!prefKey) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } })
  const prefs = (user?.settings as Record<string, unknown>)?.notificationPreferences as Record<string, boolean> | undefined
  const enabled = prefs ? prefs[prefKey] : DEFAULTS[prefKey as keyof typeof DEFAULTS]
  return enabled === false
}

interface CreateNotifParams {
  userId: string
  circleId?: string | null
  type: NotificationType
  title: string
  message: string
  link?: string | null
}

export async function createNotification(data: CreateNotifParams) {
  if (await isBlocked(data.userId, data.type)) return null
  const notif = await prisma.notification.create({ data: { userId: data.userId, circleId: data.circleId || null, type: data.type, title: data.title, message: data.message, link: data.link || null } })
  if (notif) { import("@/lib/services/push-notification.service").then((m) => m.sendPushForNotification(notif.id).catch(() => {})).catch(() => {}) }
  return notif
}

export async function createBulkNotifications(items: CreateNotifParams[]) {
  if (items.length === 0) return
  const allowed: CreateNotifParams[] = []
  for (const item of items) {
    if (!await isBlocked(item.userId, item.type)) allowed.push({ userId: item.userId, circleId: item.circleId || null, type: item.type, title: item.title, message: item.message, link: item.link || null })
  }
  if (allowed.length === 0) return
  return prisma.notification.createMany({ data: allowed })
}

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    include: { circle: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } })
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } })
  if (!n || n.userId !== userId) throw new Error("Not found")
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  })
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}

export async function notifyCircleMembers(
  circleId: string,
  excludeUserId: string | null,
  data: {
    type: NotificationType
    title: string
    message: string
    link?: string | null
  }
) {
  const members = await prisma.circleMember.findMany({
    where: {
      circleId,
      ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
    },
    select: { userId: true },
  })

  if (members.length === 0) return

  const items = members.map((m) => ({
    userId: m.userId,
    circleId,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link || null,
  }))

  return createBulkNotifications(items)
}
