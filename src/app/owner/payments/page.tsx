import { getOwnerPayments } from "@/lib/services/owner.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type PaymentRow = { id: string; merchantReference: string; user: { name?: string; email?: string } | null; plan: { name: string } | null; amount: number; currency: string; status: string; createdAt: string }

export default async function OwnerPaymentsPage() {
  await requireOwnerPage(PERMISSIONS.PAYMENTS_VIEW)

  let data: PaymentRow[] = []
  try {
    data = (await getOwnerPayments()) as unknown as PaymentRow[]
  } catch (err) {
    console.error("OWNER_PAYMENTS_QUERY_FAILED", err instanceof Error ? err.message : String(err))
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Could not load payments</h2><p className="text-sm text-muted-foreground mt-1">The payment list could not be retrieved. This may be temporary.</p></div>
          <a href="/owner/payments" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><RefreshCw className="size-4" /> Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  const columns: Column<PaymentRow>[] = [
    { key: "merchantReference", header: "Reference", accessor: (p) => <code className="font-mono text-xs">{p.merchantReference}</code> },
    { key: "user", header: "User", accessor: (p) => <span className="font-medium">{p.user?.name || p.user?.email || "—"}</span> },
    { key: "plan", header: "Plan", accessor: (p) => p.plan?.name || "—" },
    { key: "amount", header: "Amount", accessor: (p) => <span className="font-mono">R{Number(p.amount).toLocaleString()}</span>, sortable: true },
    { key: "status", header: "Status", accessor: (p) => <Badge variant="outline" className={p.status === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : p.status === "FAILED" ? "border-red-200 bg-red-50 text-red-700 text-[10px]" : "text-[10px]"}>{p.status}</Badge> },
    { key: "createdAt", header: "Date", accessor: (p) => new Date(p.createdAt).toLocaleDateString(), sortable: true },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Payments ({data.length})</h1>
      <AdvancedDataTable
        columns={columns}
        data={data}
        keyField="id"
        searchPlaceholder="Search payments..."
        emptyTitle="No payments"
        emptyDescription="Payments will appear here when users upgrade."
        rowHref={(p) => `/owner/payments/${p.id}`}
        rowActions={(p) => <Link href={`/owner/payments/${p.id}`} className="text-brand text-xs hover:underline">View</Link>}
        bulkActions={["Mark Reviewed", "Export Selected"]}
        exportHref="/api/owner/revenue/export.csv"
      />
    </div>
  )
}
