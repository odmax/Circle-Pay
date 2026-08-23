import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getPermissionAuditHistory } from "@/lib/services/permission-audit.service"
import type { PermissionAuditAction } from "@/lib/services/permission-audit.service"

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

    const allowed = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.MEMBER_AUDIT_VIEW,
    })
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(req.url)
    const affectedUserId = url.searchParams.get("affectedUserId") || undefined
    const actorUserId = url.searchParams.get("actorUserId") || undefined
    const action = (url.searchParams.get("action") || undefined) as
      | PermissionAuditAction
      | undefined
    const fromDate = url.searchParams.get("fromDate") || undefined
    const toDate = url.searchParams.get("toDate") || undefined
    const page = parseInt(url.searchParams.get("page") || "1", 10)
    const pageSize = Math.min(
      parseInt(url.searchParams.get("pageSize") || "50", 10),
      100
    )

    const result = await getPermissionAuditHistory({
      circleId,
      affectedUserId,
      actorUserId,
      action,
      fromDate,
      toDate,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch audit history"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
