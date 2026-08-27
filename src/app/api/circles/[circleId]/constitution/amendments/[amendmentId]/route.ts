import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { reviewAmendment } from "@/lib/services/constitution.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; amendmentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, amendmentId } = await params
    const body = await req.json()
    const decision = body.decision === "REJECTED" ? "REJECTED" : "APPROVED"
    const amendment = await reviewAmendment({
      circleId,
      userId: session.user.id,
      amendmentId,
      decision,
      reason: body.reason,
    })
    return NextResponse.json(amendment)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
