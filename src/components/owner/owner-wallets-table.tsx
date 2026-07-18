"use client"

import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"

export type LedgerTx = { id: string; type: string; amount: number; entryCount: number; status: string; createdAt: string }

export function OwnerWalletsTable({ transactions }: { transactions: LedgerTx[] }) {
  const columns: Column<LedgerTx>[] = [
    { key: "type", header: "Type", accessor: (t) => <Badge variant="outline" className="text-[10px]">{t.type}</Badge> },
    { key: "amount", header: "Amount", accessor: (t) => <span className="font-mono">R{Number(t.amount).toLocaleString()}</span>, sortable: true },
    { key: "entryCount", header: "Entries", accessor: (t) => String(t.entryCount) },
    { key: "status", header: "Status", accessor: (t) => <Badge variant="outline" className={t.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : t.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "text-[10px]"}>{t.status}</Badge> },
    { key: "createdAt", header: "Date", accessor: (t) => new Date(t.createdAt).toLocaleDateString(), sortable: true },
  ]

  return (
    <AdvancedDataTable columns={columns} data={transactions} keyField="id" searchPlaceholder="Filter transactions..." emptyTitle="No transactions" />
  )
}
