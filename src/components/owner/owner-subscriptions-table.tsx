"use client"

import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export type SubRow = { id: string; user: { name?: string; email?: string } | null; plan: { name: string } | null; status: string; currentPeriodStart: string; currentPeriodEnd: string }

export function OwnerSubscriptionsTable({ subscriptions }: { subscriptions: SubRow[] }) {
  const columns: Column<SubRow>[] = [
    { key: "user", header: "User", accessor: (s) => <span className="font-medium">{s.user?.name || s.user?.email || "—"}</span> },
    { key: "plan", header: "Plan", accessor: (s) => <Badge variant="outline" className="text-[10px]">{s.plan?.name || "—"}</Badge> },
    { key: "status", header: "Status", accessor: (s) => <Badge variant="outline" className={s.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : s.status === "PAST_DUE" ? "border-red-200 bg-red-50 text-red-700 text-[10px]" : "text-[10px]"}>{s.status}</Badge> },
    { key: "currentPeriodStart", header: "Start", accessor: (s) => new Date(s.currentPeriodStart).toLocaleDateString(), sortable: true },
    { key: "currentPeriodEnd", header: "End", accessor: (s) => new Date(s.currentPeriodEnd).toLocaleDateString(), sortable: true },
  ]

  return (
    <AdvancedDataTable
      columns={columns}
      data={subscriptions}
      keyField="id"
      searchPlaceholder="Search subscriptions..."
      emptyTitle="No subscriptions"
      emptyDescription="Subscriptions will appear here when users upgrade."
      rowHref={(s) => `/owner/subscriptions/${s.id}`}
      rowActions={(s) => <Link href={`/owner/subscriptions/${s.id}`} className="text-brand text-xs hover:underline">View</Link>}
      bulkActions={["Export Selected"]}
    />
  )
}
