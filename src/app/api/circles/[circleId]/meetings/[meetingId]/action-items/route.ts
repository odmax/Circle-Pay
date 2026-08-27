import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { addActionItem } from "@/lib/services/meeting.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const body = await req.json()
    const item = await addActionItem(circleId, meetingId, session.user.id, body)
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
