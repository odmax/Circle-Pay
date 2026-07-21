import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { restoreContribution } from "@/lib/services/contribution.service"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, contributionId } = await params
    const contribution = await restoreContribution(circleId, contributionId, session.user.id)
    return NextResponse.json(contribution)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to restore contribution"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions" || msg === "Contribution is not deleted"
        ? msg === "Contribution is not deleted" ? 400 : 403
        : msg === "Contribution not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
