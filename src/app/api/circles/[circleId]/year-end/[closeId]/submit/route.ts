import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { submitYearEndForApproval } from "@/lib/services/year-end-close.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; closeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, closeId } = await params
  try {
    const close = await submitYearEndForApproval(circleId, closeId, session.user.id)
    return NextResponse.json({ close })
  } catch (error) {
    console.error("Error submitting year-end close:", error)
    const message = error instanceof Error ? error.message : "Failed to submit close"
    const status = message.includes("denied") ? 403 : message.includes("blockers") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
