import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AllocationRow {
  id: string
  amount: number
  allocationDate: Date
  note: string | null
  user: { id: string; name: string | null; email: string; image: string | null }
  createdBy: { id: string; name: string | null }
}

export function GoalAllocationHistory({
  allocations,
  currencySymbol,
}: {
  allocations: AllocationRow[]
  currencySymbol: string
}) {
  if (allocations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No allocations yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {allocations.map((a) => {
        const initials = a.user.name
          ? a.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
          : "??"
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3"
          >
            <Avatar className="size-8">
              <AvatarImage src={a.user.image || ""} />
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {a.user.name || a.user.email}
              </p>
              {a.note && (
                <p className="text-xs text-muted-foreground truncate">{a.note}</p>
              )}
            </div>
            <div className="text-right">
              <span className="font-mono text-sm font-bold text-emerald-600">
                +{currencySymbol}
                {a.amount.toLocaleString()}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {new Date(a.allocationDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
