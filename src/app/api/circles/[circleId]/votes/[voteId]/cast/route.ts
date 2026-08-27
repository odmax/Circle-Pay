import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { castVote } from "@/lib/services/governance.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; voteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, voteId } = await params
    const body = await req.json()
    if (!body.optionId) return NextResponse.json({ error: "optionId required" }, { status: 400 })
    const record = await castVote(circleId, voteId, session.user.id, body.optionId, body.rank)
    return NextResponse.json(record)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
