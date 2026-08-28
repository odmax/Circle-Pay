import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { correctCampaign } from "@/lib/services/grocery.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params
  try {
    const body = await req.json()
    const data = await correctCampaign(circleId, campaignId, session.user.id, {
      remainingBalanceDelta: body.remainingBalanceDelta != null ? Number(body.remainingBalanceDelta) : undefined,
      reopen: body.reopen,
      note: body.note ?? body.reason,
    })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to correct campaign"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
