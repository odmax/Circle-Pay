import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { submitLoanRepayment } from "@/lib/services/loan.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; loanId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, loanId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  try {
    const repayment = await submitLoanRepayment(circleId, loanId, session.user.id, {
      scheduleId: typeof body.scheduleId === "string" ? body.scheduleId : "",
      amount: typeof body.amount === "number" ? body.amount : NaN,
      proofUrl: typeof body.proofUrl === "string" ? body.proofUrl : undefined,
      proofReference: typeof body.proofReference === "string" ? body.proofReference : undefined,
    })
    return NextResponse.json({ repayment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit repayment"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
