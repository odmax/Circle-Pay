import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserNotifications, getUnreadCount } from "@/lib/services/notification.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(session.user.id),
      getUnreadCount(session.user.id),
    ])
    return NextResponse.json({ notifications, unreadCount })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
