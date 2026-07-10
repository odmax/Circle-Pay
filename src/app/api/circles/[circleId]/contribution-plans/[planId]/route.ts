import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  updateContributionPlan,
  deleteContributionPlan,
} from "@/lib/services/contribution.service"
import { updateContributionPlanSchema } from "@/lib/validations/contributions"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; planId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, planId } = await params
    const body = await req.json()
    const parsed = updateContributionPlanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const plan = await updateContributionPlan(
      circleId,
      planId,
      session.user.id,
      parsed.data
    )
    return NextResponse.json(plan)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update plan"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Plan not found"
        ? msg === "Plan not found" ? 404 : 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; planId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, planId } = await params
    await deleteContributionPlan(circleId, planId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete plan"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Plan not found"
        ? msg === "Plan not found" ? 404 : 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
