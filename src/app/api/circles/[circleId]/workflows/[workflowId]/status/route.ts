import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { changeWorkflowStatus } from "@/lib/services/approval-workflow.service"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { workflowId } = await params
  const body = await request.json()

  try {
    const workflow = await changeWorkflowStatus({
      workflowId,
      userId: session.user.id,
      status: body.status,
    })
    return NextResponse.json({ workflow })
  } catch (error) {
    console.error("Error changing workflow status:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to change workflow status" },
      { status: 500 }
    )
  }
}
