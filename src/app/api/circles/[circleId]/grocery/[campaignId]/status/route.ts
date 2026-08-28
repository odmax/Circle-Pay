import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { setCampaignStatus } from "@/lib/services/grocery.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params
  try {
    const body = await req.json()
    const data = await setCampaignStatus(circleId, campaignId, session.user.id, body.status)
    return NextResponse.json({ campaign: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update status"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
