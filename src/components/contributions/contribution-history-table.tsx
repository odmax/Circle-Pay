import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ContributionStatusBadge } from "./contribution-status-badge"

interface ContributionRow {
  id: string
  amount: number
  status: string
  paymentDate: Date
  note: string | null
  createdAt: Date
  user: { id: string; name: string | null; email: string; image: string | null }
  plan: { id: string; name: string; amount: number } | null
  createdBy: { id: string; name: string | null }
}

export function ContributionHistoryTable({
  contributions,
  currencySymbol,
}: {
  contributions: ContributionRow[]
  currencySymbol: string
}) {
  if (contributions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
          <span className="text-lg text-muted-foreground">R</span>
        </div>
        <h4 className="text-sm font-medium">No contributions yet</h4>
        <p className="text-xs text-muted-foreground">
          Record a payment to get started
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-left text-xs font-medium text-muted-foreground">
            <th className="pb-3 pl-1 pr-3">Member</th>
            <th className="px-3 pb-3">Amount</th>
            <th className="px-3 pb-3">Plan</th>
            <th className="px-3 pb-3">Date</th>
            <th className="px-3 pb-3">Status</th>
            <th className="px-3 pb-3 hidden sm:table-cell">Note</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((c) => {
            const initials = c.user.name
              ? c.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "??"

            return (
              <tr
                key={c.id}
                className="border-b border-border/20 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 pl-1 pr-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarImage src={c.user.image || ""} />
                      <AvatarFallback className="text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate max-w-[100px]">
                      {c.user.name || c.user.email}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono font-medium">
                  {currencySymbol}
                  {Number(c.amount).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {c.plan?.name || "—"}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                  {new Date(c.paymentDate).toLocaleDateString()}
                </td>
                <td className="px-3 py-3">
                  <ContributionStatusBadge status={c.status} />
                </td>
                <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell max-w-[120px] truncate">
                  {c.note || "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
