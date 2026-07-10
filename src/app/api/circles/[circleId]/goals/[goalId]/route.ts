import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateGoal, deleteGoal } from "@/lib/services/goal.service"
import { updateGoalSchema } from "@/lib/validations/goals"

export async function PATCH(
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
    const parsed = updateGoalSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const goal = await updateGoal(circleId, goalId, session.user.id, parsed.data)
    return NextResponse.json(goal)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update goal"
    const code =
      msg === "Insufficient permissions" ? 403 : msg === "Goal not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; goalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, goalId } = await params
    await deleteGoal(circleId, goalId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete goal"
    const code =
      msg === "Insufficient permissions" ? 403 : msg === "Goal not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}
