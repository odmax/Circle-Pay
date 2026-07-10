import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAllocations, allocateToGoal } from "@/lib/services/goal.service"
import { allocateGoalSchema } from "@/lib/validations/goals"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; goalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, goalId } = await params
    const allocations = await getAllocations(circleId, goalId, session.user.id)
    return NextResponse.json(allocations)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch allocations"
    return NextResponse.json({ error: msg }, { status: msg.includes("Not") ? 403 : 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; goalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, goalId } = await params
    const body = await req.json()
    const parsed = allocateGoalSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const allocation = await allocateToGoal(
      circleId,
      goalId,
      session.user.id,
      parsed.data
    )
    return NextResponse.json(allocation, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to allocate"
    const code =
      msg === "Insufficient permissions" || msg.includes("own funds")
        ? 403
        : msg === "Goal not found" || msg.includes("non-active")
          ? 400
          : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}
