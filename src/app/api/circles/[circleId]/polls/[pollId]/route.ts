import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { votePoll, closePoll } from "@/lib/services/poll.service"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; pollId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, pollId } = await params
    const { optionId, action } = await req.json()
    if (action === "vote") return NextResponse.json(await votePoll(circleId, pollId, s.user.id, optionId))
    if (action === "close") return NextResponse.json(await closePoll(circleId, pollId, s.user.id))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
