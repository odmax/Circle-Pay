import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rejectLoanRepayment } from "@/lib/services/loan.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; loanId: string; repaymentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, loanId, repaymentId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  try {
    const repayment = await rejectLoanRepayment(circleId, repaymentId, session.user.id, typeof body.reason === "string" ? body.reason : undefined)
    return NextResponse.json({ repayment })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject repayment"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
