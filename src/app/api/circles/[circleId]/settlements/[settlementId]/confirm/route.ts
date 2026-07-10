import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { confirmSettlement } from "@/lib/services/balance.service"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; settlementId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, settlementId } = await params
    const settlement = await confirmSettlement(circleId, settlementId, session.user.id)
    return NextResponse.json(settlement)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : msg.includes("authorized") ? 403 : 400 })
  }
}
