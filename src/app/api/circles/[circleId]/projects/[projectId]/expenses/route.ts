import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getExpenseDashboard, createExpense } from "@/lib/services/project-expense.service"

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
    return NextResponse.json(await getExpenseDashboard(projectId))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const canAccess = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const allowed = await hasCirclePermission({
    userId: s.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.PROJECT_EXPENSE_CREATE,
  })
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const data = await req.json()
    const result = await createExpense(projectId, circleId, s.user.id, data)
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
