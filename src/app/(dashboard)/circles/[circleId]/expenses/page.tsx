import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { listExpenses, getExpenseSummary } from "@/lib/services/expense.service"
import { AddExpenseForm } from "@/components/expenses/add-expense-form"
import { ExpenseHistoryTable } from "@/components/expenses/expense-history-table"
import { ExpenseSummaryCards } from "@/components/expenses/expense-summary-cards"
import { CURRENCIES } from "@/lib/constants"

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle, expenses, summary
  try {
    ;[circle, expenses, summary] = await Promise.all([
      getCircleById(circleId, session.user.id),
      listExpenses(circleId, session.user.id),
      getExpenseSummary(circleId, session.user.id),
    ])
  } catch {
    notFound()
  }

  const currency = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = currency?.symbol ?? circle.currency

  const membersForForm = circle.members.map((m) => ({
    id: m.user.id,
    name: m.user.name || m.user.email,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            render={<Link href={`/circles/${circleId}`} />}
            variant="outline"
            size="icon"
            className="rounded-xl"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground">{circle.name}</p>
          </div>
        </div>
        <AddExpenseForm
          circleId={circleId}
          members={membersForForm}
          currencySymbol={symbol}
        />
      </div>

      <ExpenseSummaryCards
        totalExpenses={summary.totalExpenses}
        amountIPaid={summary.amountIPaid}
        amountIOwe={summary.amountIOwe}
        amountOwedToMe={summary.amountOwedToMe}
        currencySymbol={symbol}
      />

      <ExpenseHistoryTable expenses={expenses} currencySymbol={symbol} />
    </div>
  )
}
