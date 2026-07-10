import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getExpenseById, deleteExpense } from "@/lib/services/expense.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; expenseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId, expenseId } = await params
    const expense = await getExpenseById(circleId, expenseId, session.user.id)
    return NextResponse.json(expense)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg === "Expense not found" ? 404 : 403 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; expenseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId, expenseId } = await params
    await deleteExpense(circleId, expenseId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    const code = msg === "Insufficient permissions" ? 403 : msg === "Expense not found" ? 404 : 400
    return NextResponse.json({ error: msg }, { status: code })
  }
}
