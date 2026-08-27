import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleVotes, createVote } from "@/lib/services/governance.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const votes = await getCircleVotes(circleId, session.user.id)
    return NextResponse.json(votes)
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
    const vote = await createVote(circleId, session.user.id, body)
    return NextResponse.json(vote, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
