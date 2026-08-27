import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { cancelMeeting } from "@/lib/services/meeting.service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const meeting = await cancelMeeting(circleId, meetingId, session.user.id)
    return NextResponse.json(meeting)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
