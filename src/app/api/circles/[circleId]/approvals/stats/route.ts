import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getApprovalStats } from "@/lib/services/approval.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const stats = await getApprovalStats(circleId)

    return NextResponse.json(stats)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch approval stats"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
