import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleWalletDashboard, getCircleWalletTransactions } from "@/lib/services/wallet.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "WALLET_TRACKING")) return NextResponse.json({ error: "Wallet tracking requires a paid plan" }, { status: 403 })
  const { circleId } = await params
  try {
    const url = new URL(req.url)
    if (url.searchParams.get("transactions") === "true") {
      return NextResponse.json(await getCircleWalletTransactions(circleId, s.user.id))
    }
    return NextResponse.json(await getCircleWalletDashboard(circleId, s.user.id))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}
