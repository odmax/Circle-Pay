import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { finalizeYearEnd } from "@/lib/services/year-end-close.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; closeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, closeId } = await params
  try {
    const close = await finalizeYearEnd(circleId, closeId, session.user.id)
    return NextResponse.json({ close })
  } catch (error) {
    console.error("Error finalizing year-end close:", error)
    const message = error instanceof Error ? error.message : "Failed to finalize close"
    const status = message.includes("denied") ? 403 : message.includes("already finalized") ? 400 : message.includes("Blockers") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
