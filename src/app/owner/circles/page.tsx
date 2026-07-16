import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getOwnerCircles } from "@/lib/services/owner.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { CircleTypeBadge } from "@/components/circles/circle-type-badge"

type CircleRow = { id: string; name: string; type: string; owner: { name?: string; email?: string } | null; memberCount: number; visibility: string; verification: string; reputation: number; createdAt: string }

export default async function OwnerCirclesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireOwnerPage(PERMISSIONS.CIRCLES_VIEW)
  const params = await searchParams
  const page = parseInt(params.page || "1")
  const data = await getOwnerCircles({ ...params, page })
  const s = data.summary
  const items = data.items as unknown as CircleRow[]

  const columns: Column<CircleRow>[] = [
    { key: "name", header: "Name", accessor: (c) => <span className="font-medium truncate block max-w-[180px]">{c.name}</span>, sortable: true },
    { key: "type", header: "Type", accessor: (c) => <CircleTypeBadge type={c.type as any} /> },
    { key: "owner", header: "Owner", accessor: (c) => <span className="text-muted-foreground">{c.owner?.name || c.owner?.email || "—"}</span>, hideOnMobile: true },
    { key: "memberCount", header: "Members", sortable: true },
    { key: "visibility", header: "Visibility", accessor: (c) => <Badge variant="outline" className="text-[10px]">{c.visibility}</Badge>, hideOnMobile: true },
    { key: "verification", header: "Verify", accessor: (c) => <Badge variant="outline" className={c.verification === "VERIFIED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : c.verification === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "text-[10px]"}>{c.verification}</Badge>, hideOnMobile: true },
    { key: "reputation", header: "Rep", hideOnMobile: true },
  ]

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Circles ({data.totalCount})</h1><p className="text-muted-foreground">{s.active} active · {s.public} public · {s.verified} verified · {s.totalMembers} total members</p></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-center">
        {[{ label: "Active", val: s.active }, { label: "Public", val: s.public }, { label: "Verified", val: s.verified }, { label: "Deactivated", val: s.deactivated }, { label: "Total Members", val: s.totalMembers }].map((stat) => (
          <Card key={stat.label} className="rounded-2xl"><CardContent className="p-3"><div className="text-xl font-bold">{stat.val}</div><p className="text-xs text-muted-foreground">{stat.label}</p></CardContent></Card>
        ))}
      </div>

      <AdvancedDataTable
        columns={columns}
        data={items}
        keyField="id"
        searchPlaceholder="Search circles..."
        emptyTitle="No circles"
        emptyDescription="Circles will appear here when users create them."
        rowHref={(c) => `/owner/circles/${c.id}`}
        rowActions={(c) => <Link href={`/owner/circles/${c.id}`} className="text-brand text-xs hover:underline">Manage</Link>}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        bulkActions={["Add Note", "Export Selected"]}
        filters={
          <div className="flex flex-wrap gap-1">{[{ label: "All", value: "" }, { label: "Public", value: "visibility=PUBLIC" }, { label: "Private", value: "visibility=PRIVATE" }, { label: "Stokvel", value: "type=STOKVEL" }, { label: "Verified", value: "verification=VERIFIED" }, { label: "Deactivate", value: "isActive=false" }].map((t) => (
            <Link key={t.label} href={`/owner/circles?${t.value}`}><Badge variant="outline" className="cursor-pointer rounded-lg">{t.label}</Badge></Link>
          ))}</div>
        }
      />
    </div>
  )
}
