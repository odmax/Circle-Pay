import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { getProjectInvestmentDashboard } from "@/lib/services/project-investment.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)
    const [canManage, canRecordFunding, canApprove] = await Promise.all([
      hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE }),
      hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.FUNDING_RECORD }),
      hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE }),
    ])
    const data = await getProjectInvestmentDashboard(projectId, circleId, s.user.id)
    return NextResponse.json({ ...data, meta: { userId: s.user.id, canManage, canRecordFunding, canApprove } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}