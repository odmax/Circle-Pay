import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateAgendaItem } from "@/lib/services/meeting.service"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string; itemId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId, itemId } = await params
    const body = await req.json()
    const item = await updateAgendaItem(circleId, meetingId, itemId, session.user.id, body)
    return NextResponse.json(item)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
