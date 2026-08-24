import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { approveShortfallCover } from "@/lib/services/project-shortfall.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; shortfallId: string }> },
) {
  try {
    const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId, shortfallId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)
    const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.SHORTFALL_MANAGE })
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await approveShortfallCover(shortfallId, s.user.id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
