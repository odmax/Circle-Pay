import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordDisbursement } from "@/lib/services/loan.service"

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
    const disbursement = await recordDisbursement(circleId, loanId, session.user.id, {
      amount: typeof body.amount === "number" ? body.amount : undefined,
      method: typeof body.method === "string" ? body.method : undefined,
      reference: typeof body.reference === "string" ? body.reference : undefined,
      proofUrl: typeof body.proofUrl === "string" ? body.proofUrl : undefined,
      proofReference: typeof body.proofReference === "string" ? body.proofReference : undefined,
    })
    return NextResponse.json({ disbursement }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record disbursement"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
