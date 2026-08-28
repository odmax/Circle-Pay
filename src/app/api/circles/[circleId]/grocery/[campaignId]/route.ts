import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCampaign, updateCampaign } from "@/lib/services/grocery.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params
  try {
    const data = await getCampaign(circleId, campaignId, session.user.id)
    return NextResponse.json({ campaign: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load campaign"
    const status = message.includes("denied") ? 403 : message === "Campaign not found" ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params
  try {
    const body = await req.json()
    const data = await updateCampaign(circleId, campaignId, session.user.id, {
      name: body.name,
      description: body.description,
      targetAmount: body.targetAmount != null ? Number(body.targetAmount) : undefined,
      contributionStart: body.contributionStart,
      contributionEnd: body.contributionEnd,
      distributionDate: body.distributionDate,
      estimatedCost: body.estimatedCost != null ? Number(body.estimatedCost) : undefined,
    })
    return NextResponse.json({ campaign: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update campaign"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
