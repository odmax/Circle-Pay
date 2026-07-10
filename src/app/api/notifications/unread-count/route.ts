import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUnreadCount } from "@/lib/services/notification.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const count = await getUnreadCount(session.user.id)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
