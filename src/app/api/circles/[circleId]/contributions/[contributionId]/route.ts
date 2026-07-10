import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  updateContribution,
  deleteContribution,
} from "@/lib/services/contribution.service"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, contributionId } = await params
    const body = await req.json()

    const contribution = await updateContribution(
      circleId,
      contributionId,
      session.user.id,
      body
    )
    return NextResponse.json(contribution)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update contribution"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Contribution not found"
        ? msg === "Contribution not found" ? 404 : 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, contributionId } = await params
    await deleteContribution(circleId, contributionId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete contribution"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Contribution not found"
        ? msg === "Contribution not found" ? 404 : 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
