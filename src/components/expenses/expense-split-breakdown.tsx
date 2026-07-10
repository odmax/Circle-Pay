interface SplitEntry {
  id: string
  userId: string
  amount: number
  percentage: number | null
  settled: boolean
  user: { id: string; name: string | null; email: string }
}

export function ExpenseSplitBreakdown({
  splits,
  paidById,
  currencySymbol,
}: {
  splits: SplitEntry[]
  paidById: string
  currencySymbol: string
}) {
  return (
    <div className="space-y-1.5">
      {splits.map((s) => {
        const isPayer = s.userId === paidById
        return (
          <div key={s.id} className="flex items-center justify-between text-sm">
            <span className="truncate">
              {s.user.name || s.user.email}
              {isPayer && (
                <span className="ml-1.5 text-[10px] font-medium text-brand">(paid)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {s.percentage !== null && (
                <span className="text-xs text-muted-foreground">{s.percentage}%</span>
              )}
              <span
                className={`font-mono text-sm font-medium ${
                  s.settled ? "text-emerald-600" : isPayer ? "text-muted-foreground" : "text-amber-600"
                }`}
              >
                {isPayer ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${currencySymbol}${s.amount.toLocaleString()}`
                )}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
