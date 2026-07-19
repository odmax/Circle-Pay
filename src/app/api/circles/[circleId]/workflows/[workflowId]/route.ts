import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWorkflowById, updateWorkflow, deleteWorkflow } from "@/lib/services/approval-workflow.service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { workflowId } = await params

  try {
    const workflow = await getWorkflowById(workflowId)
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }
    return NextResponse.json({ workflow })
  } catch (error) {
    console.error("Error fetching workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch workflow" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { circleId, workflowId } = await params
  const body = await request.json()

  try {
    const workflow = await updateWorkflow({
      workflowId,
      userId: session.user.id,
      ...body,
    })
    return NextResponse.json({ workflow })
  } catch (error) {
    console.error("Error updating workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update workflow" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; workflowId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { workflowId } = await params

  try {
    await deleteWorkflow({ workflowId, userId: session.user.id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete workflow" },
      { status: 500 }
    )
  }
}
