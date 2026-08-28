import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordAdjustment } from "@/lib/services/year-end-close.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; closeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, closeId } = await params
  const body = (await req.json()) as {
    userId?: string
    type?: string
    reason?: string
    beforeValue?: Record<string, unknown>
    afterValue?: Record<string, unknown>
  }
  if (!body.userId || !body.type || !body.reason) {
    return NextResponse.json({ error: "userId, type and reason are required" }, { status: 400 })
  }
  try {
    const adjustment = await recordAdjustment(circleId, closeId, session.user.id, {
      userId: body.userId,
      type: body.type,
      reason: body.reason,
      beforeValue: body.beforeValue,
      afterValue: body.afterValue,
    })
    return NextResponse.json({ adjustment }, { status: 201 })
  } catch (error) {
    console.error("Error recording year-end adjustment:", error)
    const message = error instanceof Error ? error.message : "Failed to record adjustment"
    const status = message.includes("denied") ? 403 : message.includes("locked") ? 400 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
