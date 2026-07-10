import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listExpenses, createExpense, getExpenseSummary } from "@/lib/services/expense.service"
import { createExpenseSchema } from "@/lib/validations/expenses"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const url = new URL(req.url)

    if (url.searchParams.get("summary") === "true") {
      const summary = await getExpenseSummary(circleId, session.user.id)
      return NextResponse.json(summary)
    }

    const expenses = await listExpenses(circleId, session.user.id)
    return NextResponse.json(expenses)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("Not") ? 403 : 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const body = await req.json()
    const parsed = createExpenseSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const expense = await createExpense(circleId, session.user.id, parsed.data)
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create expense"
    return NextResponse.json({ error: msg }, { status: msg.includes("permission") ? 403 : msg.includes("member") ? 400 : 500 })
  }
}
