import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPayoutReconciliationReport } from "@/lib/services/year-end-close.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; closeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, closeId } = await params
  try {
    const data = await getPayoutReconciliationReport(circleId, session.user.id, closeId)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching payout reconciliation:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch payout reconciliation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
