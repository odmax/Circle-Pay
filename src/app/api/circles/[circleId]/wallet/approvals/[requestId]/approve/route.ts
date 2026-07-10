import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { approvePayoutRequest } from "@/lib/services/wallet.service"

export async function POST(_req: Request, { params }: { params: Promise<{ circleId: string; requestId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json(await approvePayoutRequest((await params).circleId, (await params).requestId, s.user.id)) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
