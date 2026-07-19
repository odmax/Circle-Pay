import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWorkflows, createWorkflow } from "@/lib/services/approval-workflow.service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { circleId } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") as any
  const status = searchParams.get("status") as any

  try {
    const workflows = await getWorkflows(circleId, { type, status })
    return NextResponse.json({ workflows })
  } catch (error) {
    console.error("Error fetching workflows:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch workflows" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { circleId } = await params
  const body = await request.json()

  try {
    const workflow = await createWorkflow({
      circleId,
      name: body.name,
      description: body.description,
      type: body.type,
      priority: body.priority,
      minimumAmount: body.minimumAmount,
      maximumAmount: body.maximumAmount,
      currency: body.currency,
      isDefault: body.isDefault,
      createdById: session.user.id,
      stages: body.stages,
    })
    return NextResponse.json({ workflow }, { status: 201 })
  } catch (error) {
    console.error("Error creating workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create workflow" },
      { status: 500 }
    )
  }
}
