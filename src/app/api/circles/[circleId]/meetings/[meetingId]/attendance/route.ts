import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordAttendance } from "@/lib/services/meeting.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const { getMeetingById } = await import("@/lib/services/meeting.service")
    const meeting = await getMeetingById(circleId, meetingId, session.user.id)
    return NextResponse.json(meeting.attendance)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const body = await req.json()
    if (!Array.isArray(body.entries)) return NextResponse.json({ error: "entries array required" }, { status: 400 })
    const records = await recordAttendance(circleId, meetingId, session.user.id, body.entries)
    return NextResponse.json(records)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
