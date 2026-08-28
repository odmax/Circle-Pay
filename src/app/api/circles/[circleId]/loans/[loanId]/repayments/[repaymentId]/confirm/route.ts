import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { confirmLoanRepayment } from "@/lib/services/loan.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; loanId: string; repaymentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, loanId, repaymentId } = await params
  try {
    const repayment = await confirmLoanRepayment(circleId, repaymentId, session.user.id)
    return NextResponse.json({ repayment })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm repayment"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
