import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listCampaigns, createCampaign } from "@/lib/services/grocery.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const campaigns = await listCampaigns(circleId, session.user.id)
    return NextResponse.json({ campaigns })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load campaigns"
    const status = message.includes("denied") ? 403 : message === "Not a member" ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const body = await req.json()
    const campaign = await createCampaign(circleId, session.user.id, {
      name: body.name,
      description: body.description,
      targetAmount: Number(body.targetAmount),
      contributionStart: body.contributionStart,
      contributionEnd: body.contributionEnd,
      distributionDate: body.distributionDate,
      estimatedCost: body.estimatedCost != null ? Number(body.estimatedCost) : undefined,
    })
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create campaign"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
