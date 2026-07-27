import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  createExpense,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  voidExpense,
  correctExpense,
  duplicateExpense,
  getExpenseById,
} from "@/lib/services/project-expense.service"

async function requireAuth(circleId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) throw new Error("Not found")
  return s.user.id
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; expenseId: string }> },
) {
  try {
    const { circleId, projectId, expenseId } = await params
    await requireAuth(circleId)
    await requireProjectInCircle(projectId, circleId)
    const expense = await getExpenseById(expenseId)
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(expense)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === "Not found") return NextResponse.json({ error: msg }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; expenseId: string }> },
) {
  try {
    const { circleId, projectId, expenseId } = await params
    const userId = await requireAuth(circleId)
    await requireProjectInCircle(projectId, circleId)

    const allowed = await hasCirclePermission({
      userId,
      circleId,
      permission: CIRCLE_PERMISSIONS.PROJECT_EXPENSE_EDIT,
    })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = await req.json()
    const expense = await updateExpense(expenseId, userId, data)
    return NextResponse.json(expense)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === "Not found") return NextResponse.json({ error: msg }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; expenseId: string }> },
) {
  try {
    const { circleId, projectId, expenseId } = await params
    const userId = await requireAuth(circleId)
    await requireProjectInCircle(projectId, circleId)

    const allowed = await hasCirclePermission({
      userId,
      circleId,
      permission: CIRCLE_PERMISSIONS.PROJECT_EXPENSE_DELETE,
    })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await deleteExpense(expenseId, userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === "Not found") return NextResponse.json({ error: msg }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string; expenseId: string }> },
) {
  try {
    const { circleId, projectId, expenseId } = await params
    const userId = await requireAuth(circleId)
    await requireProjectInCircle(projectId, circleId)

    const url = new URL(req.url)
    const segments = url.pathname.split("/")
    const action = segments[segments.length - 1]

    const approvePerms = await hasCirclePermission({
      userId,
      circleId,
      permission: CIRCLE_PERMISSIONS.PROJECT_EXPENSE_APPROVE,
    })

    switch (action) {
      case "submit":
        return NextResponse.json(await submitExpense(expenseId, userId))
      case "approve": {
        if (!approvePerms) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        return NextResponse.json(await approveExpense(expenseId, userId))
      }
      case "reject": {
        if (!approvePerms) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { reason } = await req.json().catch(() => ({}))
        return NextResponse.json(await rejectExpense(expenseId, userId, reason))
      }
      case "paid": {
        if (!approvePerms) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        return NextResponse.json(await markExpensePaid(expenseId, userId))
      }
      case "void": {
        const voidAllowed = await hasCirclePermission({
          userId,
          circleId,
          permission: CIRCLE_PERMISSIONS.PROJECT_EXPENSE_VOID,
        })
        if (!voidAllowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { reason: voidReason } = await req.json()
        return NextResponse.json(await voidExpense(expenseId, userId, voidReason))
      }
      case "correct": {
        if (!approvePerms) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const correctionData = await req.json()
        return NextResponse.json(await correctExpense(expenseId, userId, correctionData))
      }
      case "duplicate":
        return NextResponse.json(await duplicateExpense(expenseId, userId))
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === "Not found") return NextResponse.json({ error: msg }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
