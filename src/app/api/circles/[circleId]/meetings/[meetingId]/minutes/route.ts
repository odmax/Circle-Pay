import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateMinutes, getMinutes } from "@/lib/services/meeting.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const minutes = await getMinutes(circleId, meetingId, session.user.id)
    return NextResponse.json(minutes)
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
    const minutes = await generateMinutes(circleId, meetingId, session.user.id, body?.content)
    return NextResponse.json(minutes, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
