import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getContributions,
  addContribution,
  getContributionSummary,
} from "@/lib/services/contribution.service"
import { addContributionSchema } from "@/lib/validations/contributions"

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
    const userId = url.searchParams.get("userId") || undefined
    const planId = url.searchParams.get("planId") || undefined
    const status = url.searchParams.get("status") || undefined
    const summary = url.searchParams.get("summary") === "true"

    if (summary) {
      const data = await getContributionSummary(circleId, session.user.id)
      return NextResponse.json(data)
    }

    const contributions = await getContributions(circleId, session.user.id, {
      userId,
      planId,
      status,
    })
    return NextResponse.json(contributions)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch contributions"
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
    const parsed = addContributionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const contribution = await addContribution(
      circleId,
      session.user.id,
      parsed.data
    )
    return NextResponse.json(contribution, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to add contribution"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions"
        ? 403
        : msg === "Members can only record their own contributions" ||
          msg === "User is not a member of this circle" ||
          msg === "Plan not found in this circle"
          ? 400
          : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
