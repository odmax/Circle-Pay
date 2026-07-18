"use client"

import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export type SupportTicketRow = { id: string; ticketNumber: string; subject: string; category: string; status: string; priority: string; user: { name?: string | null; email?: string | null } | null; createdAt: string }

export function OwnerSupportTable({ tickets }: { tickets: SupportTicketRow[] }) {
  const columns: Column<SupportTicketRow>[] = [
    { key: "ticketNumber", header: "#", accessor: (t) => <code className="font-mono text-xs">{t.ticketNumber}</code> },
    { key: "subject", header: "Subject", accessor: (t) => <span className="font-medium">{t.subject}</span> },
    { key: "user", header: "User", accessor: (t) => t.user?.name || t.user?.email || "—" },
    { key: "category", header: "Category", accessor: (t) => <Badge variant="outline" className="text-[10px]">{t.category.replace(/_/g, " ")}</Badge>, hideOnMobile: true },
    { key: "status", header: "Status", accessor: (t) => <Badge variant="outline" className={t.status === "RESOLVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : t.status === "OPEN" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "text-[10px]"}>{t.status}</Badge> },
    { key: "createdAt", header: "Created", accessor: (t) => new Date(t.createdAt).toLocaleDateString(), sortable: true },
  ]

  return (
    <AdvancedDataTable
      columns={columns}
      data={tickets}
      keyField="id"
      searchPlaceholder="Search tickets..."
      emptyTitle="No support tickets"
      emptyDescription="Tickets will appear here when users submit them."
      rowHref={(t) => `/owner/support/${t.id}`}
      rowActions={(t) => <Link href={`/owner/support/${t.id}`} className="text-brand text-xs hover:underline">View</Link>}
      filters={
        <div className="flex gap-1">{["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"].map((s) => <Link key={s} href={`/owner/support?status=${s}`}><Badge variant="outline" className="cursor-pointer rounded-lg text-[10px]">{s.replace(/_/g, " ")}</Badge></Link>)}</div>
      }
    />
  )
}
