import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  createBudgetCategory,
  getBudgetCategories,
  updateBudgetCategory,
  deleteBudgetCategory,
  getBudgetDashboard,
} from "@/lib/services/project-budget.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(_req.url)
  const dashboard = url.searchParams.get("dashboard")

  if (dashboard === "true") {
    return NextResponse.json(await getBudgetDashboard(projectId))
  }
  return NextResponse.json(await getBudgetCategories(projectId))
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const allowed = await hasCirclePermission({
    userId: s.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE,
  })
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const data = await req.json()
    const category = await createBudgetCategory(projectId, data)
    return NextResponse.json(category, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allowed = await hasCirclePermission({
    userId: s.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE,
  })
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { categoryId, ...data } = await req.json()
    if (!categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 })
    const category = await updateBudgetCategory(categoryId, data)
    return NextResponse.json(category)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allowed = await hasCirclePermission({
    userId: s.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE,
  })
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { categoryId } = await req.json()
    if (!categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 })
    await deleteBudgetCategory(categoryId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
