import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, PiggyBank, TrendingUp, TrendingDown, Wallet, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleWalletDashboard, getCircleTrialBalance } from "@/lib/services/wallet.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"
import { CURRENCIES } from "@/lib/constants"

export default async function WalletDashboardPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, walletData
  try { [circle, walletData] = await Promise.all([getCircleById(circleId, session.user.id), getCircleWalletDashboard(circleId, session.user.id)]) }
  catch { notFound() }

  if (!await hasFeature(session.user.id, "WALLET_TRACKING")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency
  const data = walletData
  const trialBalance = await getCircleTrialBalance(circleId).catch(() => null)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Tracked Ledger</h1><p className="text-muted-foreground">{circle.name}</p></div>
      </div>

      {/* Disclaimer */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/20">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">Circle Pay tracks money movement for transparency. Funds are not held by Circle Pay.</p>
        </CardContent>
      </Card>

      {!data ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><Wallet className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No wallet data yet</p><p className="text-sm text-muted-foreground">Record contributions or expenses to populate the ledger</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Tracked Balance</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${data.totalBalance >= 0 ? "text-emerald-600" : "text-amber-600"}`}>{symbol}{data.totalBalance.toLocaleString()}</div></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Ledger Inflows</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{symbol}{data.inflows.toLocaleString()}</div><p className="text-xs text-muted-foreground">Total recorded in</p></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Ledger Outflows</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{symbol}{data.outflows.toLocaleString()}</div><p className="text-xs text-muted-foreground">Total recorded out</p></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Members</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.memberCount}</div></CardContent></Card>
          </div>

          {/* Account Breakdown */}
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Ledger Accounts</CardTitle></CardHeader><CardContent>
            <div className="space-y-2">{data.accounts.map((a) => (
              <div key={a.id} className="flex justify-between items-center text-sm bg-muted/30 rounded-lg px-3 py-2">
                <span className="font-medium">{a.name}</span>
                <span className={`font-mono font-bold ${a.balance >= 0 ? "text-emerald-600" : "text-amber-600"}`}>{symbol}{a.balance.toLocaleString()}</span>
              </div>
            ))}</div>
          </CardContent></Card>

          {/* Trial Balance */}
          {trialBalance && trialBalance.accounts.length > 0 && (
            <Card className="rounded-2xl"><CardHeader className="flex items-center justify-between"><CardTitle className="text-base">Trial Balance</CardTitle><Badge variant="outline" className={trialBalance.totalCredits === trialBalance.totalDebits ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "border-red-200 bg-red-50 text-red-700 text-[10px]"}>{trialBalance.totalCredits === trialBalance.totalDebits ? "Balanced" : "Unbalanced"}</Badge></CardHeader><CardContent className="p-0">
              <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Account</th><th className="p-3 text-right">Credits</th><th className="p-3 text-right">Debits</th><th className="p-3 text-right pr-4">Balance</th></tr></thead>
                <tbody>{(trialBalance.accounts as { type: string; credits: number; debits: number; balance: number }[]).map((a, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4 font-medium">{a.type.replace(/_/g, " ")}</td><td className="p-3 text-right text-emerald-600">{symbol}{a.credits.toLocaleString()}</td><td className="p-3 text-right text-amber-600">{symbol}{a.debits.toLocaleString()}</td><td className={`p-3 text-right pr-4 font-mono font-bold ${a.balance >= 0 ? "text-emerald-600" : "text-amber-600"}`}>{symbol}{a.balance.toLocaleString()}</td></tr>
                ))}</tbody>
                <tfoot><tr className="border-t text-xs font-semibold"><td className="p-3 pl-4">Totals</td><td className="p-3 text-right text-emerald-600">{symbol}{trialBalance.totalCredits.toLocaleString()}</td><td className="p-3 text-right text-amber-600">{symbol}{trialBalance.totalDebits.toLocaleString()}</td><td className="p-3 text-right pr-4">{symbol}{(trialBalance.totalCredits - trialBalance.totalDebits).toLocaleString()}</td></tr></tfoot>
              </table>
            </CardContent></Card>
          )}

          {/* Recent Transactions */}
          <Card className="rounded-2xl"><CardHeader className="flex items-center justify-between"><CardTitle className="text-base">Recent Ledger Activity</CardTitle><Button render={<Link href={`/circles/${circleId}/wallet/transactions`} />} variant="ghost" size="sm" className="text-xs">View all</Button></CardHeader><CardContent>
            <div className="space-y-2">{data.recentTransactions.map((t) => {
              const firstEntry = t.entries[0]
              const dir = firstEntry?.type === "CREDIT" ? "in" : "out"
              return (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/20 pb-2">
                  <div>
                    <span className="font-medium capitalize">{t.type.toLowerCase()}</span>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className={`font-mono font-bold ${dir === "in" ? "text-emerald-600" : "text-amber-600"}`}>{dir === "in" ? "+" : "-"}{symbol}{t.amount.toLocaleString()}</span>
                </div>
              )
            })}</div>
          </CardContent></Card>
        </>
      )}
    </div>
  )
}
