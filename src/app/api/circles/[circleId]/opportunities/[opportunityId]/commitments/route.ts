import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { commitToOpportunity } from "@/lib/services/opportunity.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; opportunityId: string }> }) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, opportunityId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const body = await req.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })
    const commitment = await commitToOpportunity(circleId, opportunityId, s.user.id, amount)
    return NextResponse.json(commitment, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}