import { Card, CardContent } from "@/components/ui/card"
import { getOwnerCircles } from "@/lib/services/owner.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { OwnerCirclesTable, type CircleRow } from "@/components/owner/owner-circles-table"

export default async function OwnerCirclesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireOwnerPage(PERMISSIONS.CIRCLES_VIEW)
  const params = await searchParams
  const page = parseInt(params.page || "1")

  let data: any
  try {
    data = await getOwnerCircles({ ...params, page })
  } catch (err) {
    console.error("OWNER_CIRCLES_QUERY_FAILED", err instanceof Error ? err.message : String(err))
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Circles</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Could not load circles</h2><p className="text-sm text-muted-foreground mt-1">The circle list could not be retrieved. This may be temporary.</p></div>
          <a href="/owner/circles" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><RefreshCw className="size-4" /> Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  const s = data.summary
  const items = data.items as unknown as CircleRow[]

  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/circles", itemCount: items.length })

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Circles ({data.totalCount})</h1><p className="text-muted-foreground">{s.active} active · {s.public} public · {s.verified} verified · {s.totalMembers} total members</p></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-center">
        {[{ label: "Active", val: s.active }, { label: "Public", val: s.public }, { label: "Verified", val: s.verified }, { label: "Deactivated", val: s.deactivated }, { label: "Total Members", val: s.totalMembers }].map((stat) => (
          <Card key={stat.label} className="rounded-2xl"><CardContent className="p-3"><div className="text-xl font-bold">{stat.val}</div><p className="text-xs text-muted-foreground">{stat.label}</p></CardContent></Card>
        ))}
      </div>

      <OwnerCirclesTable circles={items} totalCount={data.totalCount} pageSize={data.pageSize} />
    </div>
  )
}
