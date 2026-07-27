import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getProjectFundingOverview } from "@/lib/services/project-funding.service"
import { getProjectROIDashboard } from "@/lib/services/project-roi.service"
import { getProjectDistributionDashboard } from "@/lib/services/project-distribution.service"
import { getEffectiveOwnership } from "@/lib/services/project-ownership.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { circleId, projectId } = await params

  const allowed = await hasCirclePermission({
    userId: s.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
  })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await requireProjectInCircle(projectId, circleId)

  let funding = null
  let roi = null
  let distributions: unknown[] = []
  let ownership: { total: number; owners: unknown[] } = { total: 0, owners: [] }

  try { funding = await getProjectFundingOverview(projectId) }
  catch { funding = null }

  try { roi = await getProjectROIDashboard(projectId) }
  catch { roi = null }

  try { distributions = (await getProjectDistributionDashboard(projectId))?.distributions ?? [] }
  catch { distributions = [] }

  try {
    const snap = await getEffectiveOwnership(projectId) as any
    if (snap?.entries) {
      const entries = snap.entries.slice(0, 5).map((e: any) => ({
        id: e.id,
        name: e.participant?.user?.name ?? null,
        email: e.participant?.user?.email ?? null,
        ownership: e.ownershipPercentage ?? 0,
      }))
      const total = (snap.entries as any[]).reduce((s: number, e: any) => s + (e.ownershipPercentage ?? 0), 0)
      ownership = { total, owners: entries }
    }
  } catch { ownership = { total: 0, owners: [] } }

  return NextResponse.json({
    funding: funding ? {
      summary: (funding as any).summary ?? null,
      rounds: ((funding as any).rounds ?? []).filter((r: any) => r.status === "OPEN" || r.status === "DRAFT"),
    } : null,
    roiSummary: roi ? (roi as any).summary ?? null : null,
    distributions,
    ownership,
  })
}
