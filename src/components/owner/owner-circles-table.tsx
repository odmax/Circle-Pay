"use client"

import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import { CircleTypeBadge } from "@/components/circles/circle-type-badge"
import Link from "next/link"

export type CircleRow = { id: string; name: string; type: string; owner: { name?: string; email?: string } | null; memberCount: number; visibility: string; verification: string; reputation: number; country?: string; city?: string; createdAt: string }

export function OwnerCirclesTable({ circles, totalCount, pageSize }: { circles: CircleRow[]; totalCount: number; pageSize: number }) {
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
    <AdvancedDataTable
      columns={columns}
      data={circles}
      keyField="id"
      searchPlaceholder="Search circles..."
      emptyTitle="No circles"
      emptyDescription="Circles will appear here when users create them."
      rowHref={(c) => `/owner/circles/${c.id}`}
      rowActions={(c) => <Link href={`/owner/circles/${c.id}`} className="text-brand text-xs hover:underline">Manage</Link>}
      totalCount={totalCount}
      pageSize={pageSize}
      bulkActions={["Add Note", "Export Selected"]}
      filters={
        <div className="flex flex-wrap gap-1">{[{ label: "All", value: "" }, { label: "Public", value: "visibility=PUBLIC" }, { label: "Private", value: "visibility=PRIVATE" }, { label: "Stokvel", value: "type=STOKVEL" }, { label: "Verified", value: "verification=VERIFIED" }, { label: "Deactivate", value: "isActive=false" }].map((t) => (
          <Link key={t.label} href={`/owner/circles?${t.value}`}><Badge variant="outline" className="cursor-pointer rounded-lg">{t.label}</Badge></Link>
        ))}</div>
      }
    />
  )
}
