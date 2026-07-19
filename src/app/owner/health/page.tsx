import { getOwnerHealth } from "@/lib/services/owner.service"
import { requireOwnerAdmin } from "@/lib/services/owner-permission.service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, AlertTriangle } from "lucide-react"

export default async function OwnerHealthPage() {
  await requireOwnerAdmin()
  let data
  try {
    data = await getOwnerHealth()
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Health</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Unable to load health data</h2><p className="text-sm text-muted-foreground mt-1">The health check data could not be retrieved.</p></div>
          <a href="/owner/health" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  console.info("OWNER_PAGE_DATA_READY", {
    route: "/owner/health",
    database: data.database,
    users: data.counts.users,
    circles: data.counts.circles,
    payments: data.counts.payments,
    notifications: data.counts.notifications
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Health</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatusCard label="Database" ok={true} detail={data.database} />
        <StatusCard label="PayFast" ok={data.payFastConfigured} detail={data.payFastConfigured ? "Configured" : "Not configured"} />
        <StatusCard label="App URL" ok={data.appUrlConfigured} detail={data.appUrlConfigured ? "Set" : "Missing"} />
        <StatusCard label="Auth Secret" ok={data.authSecretConfigured} detail={data.authSecretConfigured ? "Set" : "Missing"} />
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Counts</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {data.counts && Object.entries(data.counts).map(([k, v]) => (
              <div key={k}><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground capitalize">{k}</div></div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-3 p-5">
        <div className={`flex size-8 items-center justify-center rounded-lg ${ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
          {ok ? <Check className="size-4" /> : <X className="size-4" />}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}
