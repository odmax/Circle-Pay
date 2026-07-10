import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listWalletApprovalRequests, createPayoutRequest } from "@/lib/services/wallet.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "WALLET_TRACKING")) return NextResponse.json({ error: "Wallet tracking requires a paid plan" }, { status: 403 })
  try { return NextResponse.json(await listWalletApprovalRequests((await params).circleId, s.user.id)) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "WALLET_TRACKING")) return NextResponse.json({ error: "Wallet tracking requires a paid plan" }, { status: 403 })
  try {
    const { circleId } = await params
    const data = await req.json()
    return NextResponse.json(await createPayoutRequest(circleId, s.user.id, data), { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
