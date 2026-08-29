import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { publishProjectUpdate } from "@/lib/services/project-investment.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)
    const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "Update title is required" }, { status: 400 })
    }
    const activity = await publishProjectUpdate(projectId, circleId, s.user.id, { title: body.title, message: body.message })
    return NextResponse.json(activity, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}