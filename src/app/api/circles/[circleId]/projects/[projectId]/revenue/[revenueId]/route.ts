import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { approveProjectRevenue } from "@/lib/services/project-roi.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; revenueId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId, revenueId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)

    const revenue = await prisma.projectRevenue.findUnique({
      where: { id: revenueId },
      include: { asset: { select: { name: true } } },
    })
    if (!revenue) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(revenue)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; revenueId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId, revenueId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    await requireProjectInCircle(projectId, circleId)

    const data = await req.json()
    const safe: Record<string, unknown> = {}
    if (data.description !== undefined) safe.description = data.description
    if (data.reference !== undefined) safe.reference = data.reference
    if (data.grossAmount !== undefined) safe.grossAmount = data.grossAmount
    if (data.directCosts !== undefined) safe.directCosts = data.directCosts
    if (data.amount !== undefined) safe.amount = data.amount
    if (data.type !== undefined) safe.type = data.type
    if (data.revenueDate !== undefined) safe.revenueDate = new Date(data.revenueDate)
    if (data.status !== undefined) safe.status = data.status

    const revenue = await prisma.projectRevenue.update({
      where: { id: revenueId },
      data: safe as any,
    })
    return NextResponse.json(revenue)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; revenueId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId, revenueId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    await requireProjectInCircle(projectId, circleId)

    const url = new URL(req.url)
    const action = url.pathname.split("/").pop()

    if (action === "approve") return NextResponse.json(await approveProjectRevenue(revenueId, s.user.id))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; revenueId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId, revenueId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    await requireProjectInCircle(projectId, circleId)

    await prisma.projectRevenue.delete({ where: { id: revenueId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
