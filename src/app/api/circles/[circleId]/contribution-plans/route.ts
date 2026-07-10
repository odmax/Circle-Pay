import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getContributionPlans,
  createContributionPlan,
} from "@/lib/services/contribution.service"
import { createContributionPlanSchema } from "@/lib/validations/contributions"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const plans = await getContributionPlans(circleId, session.user.id)
    return NextResponse.json(plans)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch plans"
    const status = msg === "Not a member of this circle" ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
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
    const parsed = createContributionPlanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const plan = await createContributionPlan(circleId, session.user.id, parsed.data)
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create plan"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions"
        ? 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
