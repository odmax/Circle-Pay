import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleBalances, listSettlements } from "@/lib/services/balance.service"
import { BalanceSummaryCards } from "@/components/balances/balance-summary-cards"
import { BalanceList } from "@/components/balances/balance-list"
import { SettlementForm } from "@/components/balances/settlement-form"
import { SettlementHistory } from "@/components/balances/settlement-history"
import { CURRENCIES } from "@/lib/constants"

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle, balanceData, pendingSettlements, allSettlements
  try {
    ;[circle, balanceData, pendingSettlements, allSettlements] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getCircleBalances(circleId, session.user.id),
      listSettlements(circleId, session.user.id, "PENDING"),
      listSettlements(circleId, session.user.id),
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
  const canManage = circle.userRole === "OWNER" || circle.userRole === "ADMIN"

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
            <h1 className="text-2xl font-bold tracking-tight">Balances</h1>
            <p className="text-muted-foreground">{circle.name}</p>
          </div>
        </div>
        <SettlementForm
          circleId={circleId}
          members={membersForForm}
          currencySymbol={symbol}
        />
      </div>

      <BalanceSummaryCards
        totalIOwe={balanceData.totalIOwe}
        totalOwedToMe={balanceData.totalOwedToMe}
        netBalance={balanceData.netBalance}
        currencySymbol={symbol}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-base font-semibold mb-3">All Balances</h2>
            <BalanceList
              balances={balanceData.allBalances}
              currentUserId={session.user.id}
              currencySymbol={symbol}
            />
          </div>

          <div>
            <h2 className="text-base font-semibold mb-3">Settlement History</h2>
            <SettlementHistory
              settlements={allSettlements}
              circleId={circleId}
              currencySymbol={symbol}
              currentUserId={session.user.id}
              canManage={canManage}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl border-border/40">
            <CardHeader><CardTitle className="text-base">My Balances</CardTitle></CardHeader>
            <CardContent>
              <BalanceList
                balances={balanceData.myBalances}
                currentUserId={session.user.id}
                currencySymbol={symbol}
              />
            </CardContent>
          </Card>

          {pendingSettlements.length > 0 && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/20">
              <CardHeader><CardTitle className="text-base text-amber-800">Pending ({pendingSettlements.length})</CardTitle></CardHeader>
              <CardContent>
                <SettlementHistory
                  settlements={pendingSettlements}
                  circleId={circleId}
                  currencySymbol={symbol}
                  currentUserId={session.user.id}
                  canManage={canManage}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
