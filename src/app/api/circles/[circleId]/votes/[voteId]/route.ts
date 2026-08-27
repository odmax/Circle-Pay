import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getVote } from "@/lib/services/governance.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string; voteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, voteId } = await params
    const vote = await getVote(circleId, voteId, session.user.id)
    return NextResponse.json(vote)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
