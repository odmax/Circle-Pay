import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { getProjectROIDashboard } from "@/lib/services/project-roi.service"
import { getProjectFundingOverview } from "@/lib/services/project-funding.service"
import { getProjectDistributionDashboard } from "@/lib/services/project-distribution.service"
import { getEffectiveOwnership } from "@/lib/services/project-ownership.service"

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

    let roi: any = null
    let funding: any = null
    let distributions: any = null
    let ownership: any = null

    try { roi = await getProjectROIDashboard(projectId) } catch {}
    try { funding = await getProjectFundingOverview(projectId) } catch {}
    try { distributions = await getProjectDistributionDashboard(projectId) } catch {}
    try { ownership = await getEffectiveOwnership(projectId) } catch {}

    return NextResponse.json({
      roi: roi ? (roi as any).summary : null,
      funding: funding ? (funding as any).summary : null,
      distributions: distributions?.distributions ?? [],
      ownership: ownership ? {
        total: (ownership as any).entries?.reduce?.((s: number, e: any) => s + (e.ownershipPercentage ?? 0), 0) ?? 0,
        count: (ownership as any).entries?.length ?? 0,
      } : { total: 0, count: 0 },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
