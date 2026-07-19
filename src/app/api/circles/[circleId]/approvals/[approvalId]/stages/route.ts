import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRequestStageProgress } from "@/lib/services/approval-workflow-engine.service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { approvalId } = await params

  try {
    const stages = await getRequestStageProgress(approvalId)
    return NextResponse.json({ stages })
  } catch (error) {
    console.error("Error fetching stage progress:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stage progress" },
      { status: 500 }
    )
  }
}
