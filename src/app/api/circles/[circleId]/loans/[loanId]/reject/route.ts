import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rejectLoan } from "@/lib/services/loan.service"

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
    const loan = await rejectLoan(circleId, loanId, session.user.id, typeof body.reason === "string" ? body.reason : undefined)
    return NextResponse.json({ loan })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject loan"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
