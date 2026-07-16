import { getOwnerSubscriptions } from "@/lib/services/owner.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type SubRow = { id: string; user: { name?: string; email?: string } | null; plan: { name: string } | null; status: string; currentPeriodStart: string; currentPeriodEnd: string }

export default async function OwnerSubscriptionsPage() {
  await requireOwnerPage(PERMISSIONS.SUBSCRIPTIONS_VIEW)

  let subs: SubRow[] = []
  try {
    subs = (await getOwnerSubscriptions()) as unknown as SubRow[]
  } catch (err) {
    console.error("OWNER_SUBSCRIPTIONS_QUERY_FAILED", err instanceof Error ? err.message : String(err))
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Could not load subscriptions</h2><p className="text-sm text-muted-foreground mt-1">The subscription list could not be retrieved. This may be temporary.</p></div>
          <a href="/owner/subscriptions" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><RefreshCw className="size-4" /> Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  const columns: Column<SubRow>[] = [
    { key: "user", header: "User", accessor: (s) => <span className="font-medium">{s.user?.name || s.user?.email || "—"}</span> },
    { key: "plan", header: "Plan", accessor: (s) => <Badge variant="outline" className="text-[10px]">{s.plan?.name || "—"}</Badge> },
    { key: "status", header: "Status", accessor: (s) => <Badge variant="outline" className={s.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : s.status === "PAST_DUE" ? "border-red-200 bg-red-50 text-red-700 text-[10px]" : "text-[10px]"}>{s.status}</Badge> },
    { key: "currentPeriodStart", header: "Start", accessor: (s) => new Date(s.currentPeriodStart).toLocaleDateString(), sortable: true },
    { key: "currentPeriodEnd", header: "End", accessor: (s) => new Date(s.currentPeriodEnd).toLocaleDateString(), sortable: true },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Subscriptions ({subs.length})</h1>
      <AdvancedDataTable
        columns={columns}
        data={subs}
        keyField="id"
        searchPlaceholder="Search subscriptions..."
        emptyTitle="No subscriptions"
        emptyDescription="Subscriptions will appear here when users upgrade."
        rowHref={(s) => `/owner/subscriptions/${s.id}`}
        rowActions={(s) => <Link href={`/owner/subscriptions/${s.id}`} className="text-brand text-xs hover:underline">View</Link>}
        bulkActions={["Export Selected"]}
      />
    </div>
  )
}
