import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGoals, createGoal, getGoalStats } from "@/lib/services/goal.service"
import { createGoalSchema } from "@/lib/validations/goals"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const url = new URL(req.url)

    if (url.searchParams.get("stats") === "true") {
      const stats = await getGoalStats(circleId, session.user.id)
      return NextResponse.json(stats)
    }

    const goals = await getGoals(circleId, session.user.id)
    return NextResponse.json(goals)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch goals"
    return NextResponse.json({ error: msg }, { status: msg.includes("Not a member") ? 403 : 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const body = await req.json()
    const parsed = createGoalSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const goal = await createGoal(circleId, session.user.id, parsed.data)
    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create goal"
    return NextResponse.json(
      { error: msg },
      { status: msg === "Insufficient permissions" ? 403 : 500 }
    )
  }
}
