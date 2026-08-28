import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { approveYearEndClose } from "@/lib/services/year-end-close.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; closeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, closeId } = await params
  try {
    const close = await approveYearEndClose(circleId, closeId, session.user.id)
    return NextResponse.json({ close })
  } catch (error) {
    console.error("Error approving year-end close:", error)
    const message = error instanceof Error ? error.message : "Failed to approve close"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
