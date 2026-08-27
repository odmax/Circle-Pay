import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { reviewMinutes, publishMinutes, amendMinutes } from "@/lib/services/meeting.service"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string; minutesId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId, minutesId } = await params
    const body = await req.json()
    let result
    switch (body?.action) {
      case "review":
        result = await reviewMinutes(circleId, meetingId, minutesId, session.user.id)
        break
      case "publish":
        result = await publishMinutes(circleId, meetingId, minutesId, session.user.id)
        break
      case "amend":
        result = await amendMinutes(circleId, meetingId, minutesId, session.user.id, body.content)
        break
      default:
        return NextResponse.json({ error: "action must be review|publish|amend" }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
