import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getOwnerWalletDashboard, getWalletLedgerHealth } from "@/lib/services/owner-wallet.service"
import { AlertTriangle, Check } from "lucide-react"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { OwnerWalletsTable, type LedgerTx } from "@/components/owner/owner-wallets-table"

export default async function OwnerWalletsPage() {
  await requireOwnerPage(PERMISSIONS.WALLETS_VIEW)

  let data: any = { totalWallets: 0, circleWallets: 0, totalLedgerTransactions: 0, totalLedgerVolume: 0, pendingApprovals: 0, recentWalletTransactions: [], circlesWithWallets: [], recentLedgerTxs: [] }
  let health: any = { status: "HEALTHY", critical: 0, warnings: 0, exceptions: [] }

  try { data = await getOwnerWalletDashboard() } catch (err: any) {
    console.error("OWNER_WALLETS_QUERY_FAILED", { query: "getOwnerWalletDashboard", error: err?.message || String(err) })
  }
  try { health = await getWalletLedgerHealth() } catch (err: any) {
    console.error("OWNER_WALLETS_QUERY_FAILED", { query: "getWalletLedgerHealth", error: err?.message || String(err) })
  }

  const txs = (data.recentWalletTransactions || []) as unknown as LedgerTx[]

  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/wallets", itemCount: txs.length })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Wallets</h1>

      <Card className={`rounded-2xl ${health.status === "HEALTHY" ? "border-emerald-200 bg-emerald-50/20" : health.status === "WARNING" ? "border-amber-200 bg-amber-50/20" : "border-red-200 bg-red-50/20"}`}>
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex size-12 items-center justify-center rounded-xl ${health.status === "HEALTHY" ? "bg-emerald-100 text-emerald-600" : health.status === "WARNING" ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
            {health.status === "HEALTHY" ? <Check className="size-6" /> : <AlertTriangle className="size-6" />}
          </div>
          <div><p className="text-lg font-bold">{health.status === "HEALTHY" ? "All Clear" : health.status === "WARNING" ? "Warnings Detected" : "Issues Found"}</p><p className="text-sm text-muted-foreground">{health.critical} critical · {health.warnings} warnings · {health.exceptions.length} exceptions</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Wallets</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totalWallets}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Ledger Volume</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">R{data.totalLedgerVolume.toLocaleString()}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Ledger Txs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totalLedgerTransactions}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Pending Approvals</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${data.pendingApprovals > 0 ? "text-amber-600" : ""}`}>{data.pendingApprovals}</div></CardContent></Card>
      </div>

      {health.exceptions.length > 0 && (
        <Card className="rounded-2xl border-amber-200">
          <CardHeader><CardTitle className="text-base text-amber-800">Exceptions ({health.exceptions.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">{health.exceptions.map((e: any, i: any) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${e.severity === "CRITICAL" ? "bg-red-50 text-red-700 border border-red-200" : e.severity === "WARNING" ? "bg-amber-50 text-amber-700 border border-amber-200" : ""}`}>{e.severity}</span>
                <span>{e.message}</span>
              </div>
            ))}</div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Recent Ledger Transactions</CardTitle></CardHeader><CardContent className="p-0">
        <OwnerWalletsTable transactions={txs} />
      </CardContent></Card>
    </div>
  )
}
