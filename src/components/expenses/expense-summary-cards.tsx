import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react"

export function ExpenseSummaryCards({
  totalExpenses,
  amountIPaid,
  amountIOwe,
  amountOwedToMe,
  currencySymbol,
}: {
  totalExpenses: number
  amountIPaid: number
  amountIOwe: number
  amountOwedToMe: number
  currencySymbol: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencySymbol}{totalExpenses.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">You Paid</CardTitle>
          <TrendingUp className="size-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{currencySymbol}{amountIPaid.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">You Owe</CardTitle>
          <TrendingDown className="size-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{currencySymbol}{amountIOwe.toLocaleString()}</div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Owed to You</CardTitle>
          <Wallet className="size-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{currencySymbol}{amountOwedToMe.toLocaleString()}</div>
        </CardContent>
      </Card>
    </div>
  )
}
