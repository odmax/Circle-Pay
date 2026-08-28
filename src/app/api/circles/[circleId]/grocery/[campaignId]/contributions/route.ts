import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { addCampaignContribution } from "@/lib/services/grocery.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params
  try {
    const body = await req.json()
    const contribution = await addCampaignContribution(circleId, campaignId, session.user.id, {
      memberId: body.memberId,
      amount: Number(body.amount),
    })
    return NextResponse.json({ contribution }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add contribution"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
