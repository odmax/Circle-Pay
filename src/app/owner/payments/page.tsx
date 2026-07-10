import { getOwnerPayments } from "@/lib/services/owner.service"
import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type PaymentRow = { id: string; merchantReference: string; user: { name?: string; email?: string } | null; plan: { name: string } | null; amount: number; currency: string; status: string; createdAt: string }

export default async function OwnerPaymentsPage() {
  const data = (await getOwnerPayments()) as unknown as PaymentRow[]

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
