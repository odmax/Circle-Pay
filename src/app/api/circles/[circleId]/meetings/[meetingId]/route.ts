import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMeetingById, updateMeeting } from "@/lib/services/meeting.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const meeting = await getMeetingById(circleId, meetingId, session.user.id)
    return NextResponse.json(meeting)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const body = await req.json()
    const meeting = await updateMeeting(circleId, meetingId, session.user.id, body)
    return NextResponse.json(meeting)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
