"use client"

import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export type UserRow = { id: string; name: string; email: string; phone: string | null; plan: string; circleCount: number; createdAt: string }

export function OwnerUsersTable({ users }: { users: UserRow[] }) {
  const columns: Column<UserRow>[] = [
    { key: "name", header: "Name", accessor: (u) => <span className="font-medium">{u.name || "—"}</span>, sortable: true },
    { key: "email", header: "Email", sortable: true },
    { key: "phone", header: "Phone", hideOnMobile: true },
    { key: "plan", header: "Plan", accessor: (u) => <Badge variant="outline" className="text-[10px]">{u.plan}</Badge> },
    { key: "circleCount", header: "Circles", sortable: true, hideOnMobile: true },
    { key: "createdAt", header: "Joined", accessor: (u) => new Date(u.createdAt).toLocaleDateString(), sortable: true },
  ]

  return (
    <AdvancedDataTable
      columns={columns}
      data={users}
      keyField="id"
      searchPlaceholder="Search users..."
      emptyTitle="No users yet"
      emptyDescription="Users will appear here after signing up."
      rowHref={(u) => `/owner/users/${u.id}`}
      rowActions={(u) => <Link href={`/owner/users/${u.id}`} className="text-brand text-xs hover:underline">Manage</Link>}
      bulkActions={["Add Note", "Export Selected"]}
      exportHref="/api/owner/revenue/export.csv"
    />
  )
}
