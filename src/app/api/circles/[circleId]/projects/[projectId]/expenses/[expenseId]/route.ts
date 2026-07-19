import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProjectExpense, approveProjectExpense, markProjectExpensePaid, rejectProjectExpense, cancelProjectExpense, getProjectExpenseDashboard } from "@/lib/services/project-expense.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; expenseId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, expenseId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  try {
    if (action === "get") return NextResponse.json(await getProjectExpenseDashboard(projectId))
    if (action === "create") return NextResponse.json(await createProjectExpense(projectId, circleId, s.user.id, await req.json()), { status: 201 })
    if (!expenseId) return NextResponse.json({ error: "Missing expenseId" }, { status: 400 })
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (action === "approve") return NextResponse.json(await approveProjectExpense(expenseId, s.user.id))
    if (action === "paid") return NextResponse.json(await markProjectExpensePaid(expenseId, s.user.id))
    if (action === "reject") { const { reason } = await req.json().catch(() => ({})); return NextResponse.json(await rejectProjectExpense(expenseId, s.user.id, reason)) }
    if (action === "cancel") return NextResponse.json(await cancelProjectExpense(expenseId))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; expenseId?: string }> }) => {
  const url = new URL(req.url)
  const action = url.pathname.endsWith("/approve") ? "approve" : url.pathname.endsWith("/paid") ? "paid" : url.pathname.endsWith("/reject") ? "reject" : url.pathname.endsWith("/cancel") ? "cancel" : "create"
  return handle(req, ctx, action)
}
