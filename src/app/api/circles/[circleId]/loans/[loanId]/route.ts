import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLoan } from "@/lib/services/loan.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; loanId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, loanId } = await params
  try {
    const loan = await getLoan(circleId, loanId, session.user.id)
    return NextResponse.json({ loan })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch loan"
    const status = message.includes("denied") ? 403 : message.includes("Not found") ? 404 : message.includes("Not a member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
