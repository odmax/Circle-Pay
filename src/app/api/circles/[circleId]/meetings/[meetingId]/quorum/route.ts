import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getQuorumStatus } from "@/lib/services/meeting.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string; meetingId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, meetingId } = await params
    const quorum = await getQuorumStatus(circleId, meetingId, session.user.id)
    return NextResponse.json(quorum)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
