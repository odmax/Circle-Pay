import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { requireProjectInCircle } from "@/lib/services/project.service"

export async function GET(
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

    const url = new URL(req.url)
    const type = url.searchParams.get("type") ?? undefined
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")))
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { projectId }
    if (type) where.type = type

    const [activities, total] = await Promise.all([
      prisma.projectActivity.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.projectActivity.count({ where: where as any }),
    ])

    return NextResponse.json({
      activities,
      total,
      page,
      pageSize: limit,
      hasMore: skip + limit < total,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
