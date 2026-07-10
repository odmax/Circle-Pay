import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markNotificationRead } from "@/lib/services/notification.service"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { notificationId } = await params
    await markNotificationRead(session.user.id, notificationId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
