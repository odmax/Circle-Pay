import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { approveRequest, rejectRequest } from "@/lib/services/approval.service"
import { processStageDecision } from "@/lib/services/approval-workflow-engine.service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { approvalId } = await params
  const body = await request.json()
  const { decision, comment, requestStageId } = body

  try {
    if (requestStageId) {
      const result = await processStageDecision({
        approvalRequestId: approvalId,
        requestStageId,
        reviewerId: session.user.id,
        decision,
        comment,
      })
      return NextResponse.json(result)
    } else {
      if (decision === "APPROVE") {
        const result = await approveRequest({
          approvalRequestId: approvalId,
          reviewerId: session.user.id,
          comment,
        })
        return NextResponse.json(result)
      } else if (decision === "REJECT") {
        const result = await rejectRequest({
          approvalRequestId: approvalId,
          reviewerId: session.user.id,
          comment,
        })
        return NextResponse.json(result)
      } else {
        return NextResponse.json({ error: "Invalid decision" }, { status: 400 })
      }
    }
  } catch (error) {
    console.error("Error processing decision:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process decision" },
      { status: 500 }
    )
  }
}
