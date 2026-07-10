import { prisma } from "@/lib/prisma"

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send"

interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

export async function getUserActivePushTokens(userId: string) {
  return prisma.mobilePushToken.findMany({ where: { userId, isActive: true } })
}

export async function deactivateInvalidPushToken(tokenId: string) {
  await prisma.mobilePushToken.update({ where: { id: tokenId }, data: { isActive: false, lastUsedAt: new Date() } })
}

export async function sendExpoPushNotification(userId: string, payload: PushPayload) {
  const tokens = await getUserActivePushTokens(userId)
  if (tokens.length === 0) return 0

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  }))

  let sent = 0
  for (const msg of messages) {
    try {
      const r = await fetch(EXPO_PUSH_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) })
      const result = await r.json()
      if (result.data?.status === "ok") sent++
      else if (result.data?.details?.error === "DeviceNotRegistered") {
        const badToken = tokens.find((t) => t.token === msg.to)
        if (badToken) await deactivateInvalidPushToken(badToken.id)
      }
    } catch {}
  }
  return sent
}

export async function sendExpoPushNotifications(userIds: string[], payload: PushPayload) {
  let total = 0
  for (const userId of userIds) {
    total += await sendExpoPushNotification(userId, payload)
  }
  return total
}

export async function sendPushForNotification(notificationId: string) {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { circle: { select: { id: true } } },
    })
    if (!notification) return

    const payload: PushPayload = {
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...(notification.circleId ? { circleId: notification.circleId } : {}),
        ...(notification.link ? { href: notification.link } : {}),
      },
    }

    // Respect notification preferences
    const prefKey = mapTypeToPref(notification.type)
    if (prefKey) {
      const user = await prisma.user.findUnique({ where: { id: notification.userId }, select: { settings: true } })
      const prefs = (user?.settings as any)?.notificationPreferences
      if (prefs && prefs[prefKey] === false) return
    }

    await sendExpoPushNotification(notification.userId, payload)
  } catch {}
}

function mapTypeToPref(type: string): string | null {
  const map: Record<string, string> = {
    CONTRIBUTION_MADE: "contributions", CONTRIBUTION_PLAN_CREATED: "contributions", CONTRIBUTION_REMINDER: "contributions",
    EXPENSE_ADDED: "expenses",
    GOAL_CREATED: "goals", GOAL_ALLOCATION_ADDED: "goals", GOAL_COMPLETED: "goals",
    SETTLEMENT_REQUESTED: "wallet", SETTLEMENT_CONFIRMED: "wallet", SETTLEMENT_REJECTED: "wallet",
    WALLET_TRANSACTION: "wallet", WALLET_APPROVAL: "wallet",
    EVENT_REMINDER: "events", EVENT_RSVP: "events",
    POLL_CREATED: "polls", POLL_CLOSED: "polls",
    SUPPORT_REPLY: "support", SUPPORT_NEW: "support",
    BROADCAST: "broadcasts",
    SYSTEM: "system",
  }
  return map[type] || null
}
