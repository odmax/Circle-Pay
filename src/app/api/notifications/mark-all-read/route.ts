import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markAllNotificationsRead } from "@/lib/services/notification.service"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    await markAllNotificationsRead(session.user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
