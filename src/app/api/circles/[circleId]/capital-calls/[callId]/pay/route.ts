import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { payCapitalCall } from "@/lib/services/capital-call.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

// Member pays toward their allocation. For project-backed calls this creates a
// pending ProjectContribution (proof upload & confirmation continue on the
// existing project contribution routes); for opportunity-backed calls it
// creates a pending opportunity commitment.
export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; callId: string }> }) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, callId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const body = await req.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })
    const result = await payCapitalCall(circleId, callId, s.user.id, { amount, reference: body.reference })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}