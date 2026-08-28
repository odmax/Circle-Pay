import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { closeCampaign } from "@/lib/services/grocery.service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params
  try {
    const data = await closeCampaign(circleId, campaignId, session.user.id)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to close campaign"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
