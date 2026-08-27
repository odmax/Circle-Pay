import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rsvpToMeeting } from "@/lib/services/meeting.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const body = await req.json()
    if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 })
    const rsvp = await rsvpToMeeting(circleId, meetingId, session.user.id, body.status)
    return NextResponse.json(rsvp)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
