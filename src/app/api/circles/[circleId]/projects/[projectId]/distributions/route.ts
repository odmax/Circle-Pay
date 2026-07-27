import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getProjectDistributionDashboard } from "@/lib/services/project-distribution.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  return NextResponse.json(await getProjectDistributionDashboard(projectId))
}
