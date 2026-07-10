import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rejectJoinRequest } from "@/lib/services/join-request.service"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; requestId: string }> }
) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, requestId } = await params
    await rejectJoinRequest(circleId, requestId, s.user.id)
    return NextResponse.json({ success: true })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
