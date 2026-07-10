import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react"

export function BalanceSummaryCards({
  totalIOwe,
  totalOwedToMe,
  netBalance,
  currencySymbol,
}: {
  totalIOwe: number
  totalOwedToMe: number
  netBalance: number
  currencySymbol: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">I Owe</CardTitle>
          <TrendingDown className="size-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{currencySymbol}{totalIOwe.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Owed to Me</CardTitle>
          <TrendingUp className="size-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{currencySymbol}{totalOwedToMe.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
          <Wallet className="size-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${netBalance >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {netBalance >= 0 ? "+" : ""}{currencySymbol}{netBalance.toLocaleString()}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Settle</CardTitle>
          <ArrowRightLeft className="size-4 text-brand" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-brand">
            {totalIOwe + totalOwedToMe > 0 ? "Action needed" : "Settled"}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
