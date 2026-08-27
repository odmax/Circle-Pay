import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleMeetings, createMeeting } from "@/lib/services/meeting.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const meetings = await getCircleMeetings(circleId, session.user.id)
    return NextResponse.json(meetings)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const body = await req.json()
    const meeting = await createMeeting(circleId, session.user.id, body)
    return NextResponse.json(meeting, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
