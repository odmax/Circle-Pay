import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLoanDashboardStatus } from "@/lib/services/loan.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const status = await getLoanDashboardStatus(circleId, session.user.id)
    return NextResponse.json({ status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch loan status"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
