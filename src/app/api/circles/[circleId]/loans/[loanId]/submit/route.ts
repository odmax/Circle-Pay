import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { submitLoanForApproval } from "@/lib/services/loan.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; loanId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, loanId } = await params
  try {
    const approvalRequestId = await submitLoanForApproval(circleId, loanId, session.user.id)
    return NextResponse.json({ approvalRequestId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit loan for approval"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
