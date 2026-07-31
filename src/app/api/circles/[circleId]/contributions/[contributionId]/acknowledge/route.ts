import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { acknowledgeContributionReminder } from "@/lib/services/contribution-schedule.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId, contributionId } = await params
    const result = await acknowledgeContributionReminder(circleId, contributionId, session.user.id)
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to acknowledge reminder"
    const status = msg === "Forbidden" ? 403 : msg === "Contribution not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
