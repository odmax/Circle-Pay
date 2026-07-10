import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCirclePolls, createPoll } from "@/lib/services/poll.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "POLLS")) return NextResponse.json({ error: "Polls are not available on your plan" }, { status: 403 })
  try { return NextResponse.json(await getCirclePolls((await params).circleId)) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "POLLS")) return NextResponse.json({ error: "Polls are not available on your plan" }, { status: 403 })
  try { return NextResponse.json(await createPoll((await params).circleId, s.user.id, await req.json()), { status: 201 }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
