import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rsvpToEvent } from "@/lib/services/event.service"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; eventId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, eventId } = await params
    const { status } = await req.json()
    return NextResponse.json(await rsvpToEvent(circleId, eventId, s.user.id, status))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
