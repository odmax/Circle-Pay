import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGroceryDashboard } from "@/lib/services/grocery.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const dashboard = await getGroceryDashboard(circleId, session.user.id)
    return NextResponse.json({ dashboard })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load grocery dashboard"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
