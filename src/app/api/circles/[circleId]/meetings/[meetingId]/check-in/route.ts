import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkInToMeeting } from "@/lib/services/meeting.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const body = await req.json()
    // Default: the acting user checks themselves in; an authorized actor may check in another member.
    const targetUserId = body.userId || session.user.id
    const attendance = await checkInToMeeting(circleId, meetingId, targetUserId, session.user.id)
    return NextResponse.json(attendance)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
