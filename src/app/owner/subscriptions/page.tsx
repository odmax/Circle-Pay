import { getOwnerSubscriptions } from "@/lib/services/owner.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { OwnerSubscriptionsTable, type SubRow } from "@/components/owner/owner-subscriptions-table"

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

  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/subscriptions", itemCount: subs.length })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Subscriptions ({subs.length})</h1>
      <OwnerSubscriptionsTable subscriptions={subs} />
    </div>
  )
}
