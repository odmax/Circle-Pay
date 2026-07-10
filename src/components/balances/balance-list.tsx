import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight } from "lucide-react"

interface BalanceRow {
  id: string
  amount: number
  debtorId: string
  creditorId: string
  debtor: { id: string; name: string | null; email: string; image: string | null }
  creditor: { id: string; name: string | null; email: string; image: string | null }
}

export function BalanceList({
  balances,
  currentUserId,
  currencySymbol,
}: {
  balances: BalanceRow[]
  currentUserId: string
  currencySymbol: string
}) {
  if (balances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No outstanding balances</p>
        <p className="text-xs text-muted-foreground">Everyone is settled up!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {balances.map((b) => {
        const isDebtor = b.debtorId === currentUserId
        const dInit = b.debtor.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
        const cInit = b.creditor.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
        return (
          <div
            key={b.id}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              isDebtor
                ? "border-amber-200 bg-amber-50/30"
                : "border-emerald-200 bg-emerald-50/30"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar className="size-8"><AvatarImage src={b.debtor.image || ""} /><AvatarFallback className="text-[10px]">{dInit}</AvatarFallback></Avatar>
              <span className="text-sm font-medium truncate">{b.debtor.name || b.debtor.email}</span>
              <ArrowRight className="size-3 text-muted-foreground shrink-0" />
              <Avatar className="size-8"><AvatarImage src={b.creditor.image || ""} /><AvatarFallback className="text-[10px]">{cInit}</AvatarFallback></Avatar>
              <span className="text-sm font-medium truncate">{b.creditor.name || b.creditor.email}</span>
            </div>
            <span className={`font-mono font-bold text-sm shrink-0 ${isDebtor ? "text-amber-600" : "text-emerald-600"}`}>
              {isDebtor ? "-" : "+"}
              {currencySymbol}{b.amount.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
