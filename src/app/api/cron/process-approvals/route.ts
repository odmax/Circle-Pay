import { NextRequest, NextResponse } from "next/server"
import { processEscalations, processExpirations } from "@/lib/services/approval-workflow-engine.service"
import { expireStaleApprovals } from "@/lib/services/approval.service"
import { expireStaleDelegations } from "@/lib/services/delegation.service"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [escalationResult, expirationResult, staleApprovalResult, delegationResult] = await Promise.all([
      processEscalations(),
      processExpirations(),
      expireStaleApprovals(),
      expireStaleDelegations(),
    ])

    return NextResponse.json({
      escalations: escalationResult,
      expirations: expirationResult,
      staleApprovals: staleApprovalResult,
      delegations: delegationResult,
    })
  } catch (error) {
    console.error("Cron processing error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron processing failed" },
      { status: 500 }
    )
  }
}
