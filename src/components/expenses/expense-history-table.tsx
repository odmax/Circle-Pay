import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ExpenseCategoryBadge } from "./expense-category-badge"
import { SplitTypeBadge } from "./split-type-badge"
import { ExpenseSplitBreakdown } from "./expense-split-breakdown"

interface ExpenseRow {
  id: string
  title: string
  amount: number
  category: string
  splitType: string
  expenseDate: Date
  paidBy: { id: string; name: string | null; image: string | null }
  splits: {
    id: string
    userId: string
    amount: number
    percentage: number | null
    settled: boolean
    user: { id: string; name: string | null; email: string }
  }[]
}

export function ExpenseHistoryTable({
  expenses,
  currencySymbol,
}: {
  expenses: ExpenseRow[]
  currencySymbol: string
}) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <span className="text-lg">$</span>
        </div>
        <p className="text-sm font-medium">No expenses yet</p>
        <p className="text-xs text-muted-foreground">Record a shared expense to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {expenses.map((e) => {
        const payer = e.paidBy
        const initials = payer.name
          ? payer.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
          : "??"
        return (
          <div key={e.id} className="rounded-2xl border border-border/40 bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h4 className="font-semibold text-sm truncate">{e.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <ExpenseCategoryBadge category={e.category} />
                  <SplitTypeBadge type={e.splitType} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.expenseDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-lg">
                  {currencySymbol}{e.amount.toLocaleString()}
                </span>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <Avatar className="size-5">
                    <AvatarImage src={payer.image || ""} />
                    <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] text-muted-foreground">
                    paid by {payer.name?.split(" ")[0] || "?"}
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t border-border/30 pt-2">
              <ExpenseSplitBreakdown
                splits={e.splits}
                paidById={e.paidBy.id}
                currencySymbol={currencySymbol}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
