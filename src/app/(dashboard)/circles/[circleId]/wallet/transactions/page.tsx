import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleWalletTransactions } from "@/lib/services/wallet.service"
import { CURRENCIES } from "@/lib/constants"

export default async function WalletTransactionsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, transactions
  try { [circle, transactions] = await Promise.all([getCircleById(circleId, session.user.id), getCircleWalletTransactions(circleId, session.user.id)]) }
  catch { notFound() }

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/wallet`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Ledger Transactions</h1><p className="text-muted-foreground">{circle.name} — {transactions.length} records</p></div>
      </div>

      <Card className="rounded-2xl"><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-4">Type</th><th className="p-4">Amount</th><th className="p-4">Direction</th><th className="p-4">Status</th><th className="p-4">Date</th></tr></thead>
          <tbody>{transactions.map((t) => {
            const firstEntry = t.entries[0]
            const dir = firstEntry?.type === "CREDIT" ? "CREDIT" : "DEBIT"
            return (
              <tr key={t.id} className="border-b hover:bg-muted/30">
                <td className="p-4 font-medium capitalize">{t.type.toLowerCase()}</td>
                <td className="p-4 font-mono">{symbol}{t.amount.toLocaleString()}</td>
                <td className="p-4"><Badge variant="outline" className={dir === "CREDIT" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{dir}</Badge></td>
                <td className="p-4"><Badge variant="outline" className={t.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{t.status}</Badge></td>
                <td className="p-4 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            )
          })}</tbody>
        </table>
      </CardContent></Card>
    </div>
  )
}
