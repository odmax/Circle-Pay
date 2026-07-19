import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getActiveDelegations, createDelegation } from "@/lib/services/delegation.service"

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
  const memberId = searchParams.get("memberId")

  try {
    const delegations = await getActiveDelegations(circleId, memberId || undefined)
    return NextResponse.json({ delegations })
  } catch (error) {
    console.error("Error fetching delegations:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch delegations" },
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
    const delegation = await createDelegation({
      circleId,
      delegatorMemberId: body.delegatorMemberId,
      delegateMemberId: body.delegateMemberId,
      approvalType: body.approvalType,
      workflowId: body.workflowId,
      stageId: body.stageId,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: new Date(body.endsAt),
      reason: body.reason,
      createdById: session.user.id,
    })
    return NextResponse.json({ delegation }, { status: 201 })
  } catch (error) {
    console.error("Error creating delegation:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create delegation" },
      { status: 500 }
    )
  }
}
