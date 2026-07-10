import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getJoinRequests, requestToJoin } from "@/lib/services/join-request.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    return NextResponse.json(await getJoinRequests(circleId, s.user.id))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const { message } = await req.json()
    const result = await requestToJoin(circleId, s.user.id, message)
    return NextResponse.json(result, { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
