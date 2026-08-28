import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { applyForLoan, listLoans } from "@/lib/services/loan.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const loans = await listLoans(circleId, session.user.id)
    return NextResponse.json({ loans })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list loans"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  try {
    const loan = await applyForLoan(circleId, session.user.id, {
      principal: typeof body.principal === "number" ? body.principal : NaN,
      termMonths: typeof body.termMonths === "number" ? body.termMonths : NaN,
      purpose: typeof body.purpose === "string" ? body.purpose : undefined,
      repaymentFrequency:
        body.repaymentFrequency === "WEEKLY" || body.repaymentFrequency === "MONTHLY" || body.repaymentFrequency === "QUARTERLY"
          ? body.repaymentFrequency
          : undefined,
    })
    return NextResponse.json({ loan }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to apply for loan"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
