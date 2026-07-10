import { getOwnerHealth } from "@/lib/services/owner.service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X } from "lucide-react"

export default async function OwnerHealthPage() {
  const data = await getOwnerHealth()

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
            {Object.entries(data.counts).map(([k, v]) => (
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
