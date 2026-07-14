import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { prisma } from "@/lib/prisma"
import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import Link from "next/link"

export default async function OwnerSupportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.category) where.category = params.category
  const tickets = (await prisma.supportTicket.findMany({
    where: where as any,
    include: { user: { select: { name: true, email: true } }, circle: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })).map((t) => ({
    id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, category: t.category,
    status: t.status, priority: t.priority || "MEDIUM",
    user: { name: t.user?.name || null, email: t.user?.email || null },
    createdAt: t.createdAt.toISOString(),
  })) as unknown as Record<string, unknown>[]

  const columns: Column[] = [
    { key: "ticketNumber", header: "#", accessor: (t) => <code className="font-mono text-xs">{t.ticketNumber as string}</code> },
    { key: "subject", header: "Subject", accessor: (t) => <span className="font-medium">{t.subject as string}</span> },
    { key: "user", header: "User", accessor: (t) => (t.user as Record<string, unknown>)?.name as string || (t.user as Record<string, unknown>)?.email as string || "—" },
    { key: "category", header: "Category", accessor: (t) => <Badge variant="outline" className="text-[10px]">{(t.category as string).replace(/_/g, " ")}</Badge>, hideOnMobile: true },
    { key: "status", header: "Status", accessor: (t) => <Badge variant="outline" className={(t.status as string) === "RESOLVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : (t.status as string) === "OPEN" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "text-[10px]"}>{(t.status as string)}</Badge> },
    { key: "createdAt", header: "Created", accessor: (t) => new Date(t.createdAt as string).toLocaleDateString(), sortable: true },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Support ({tickets.length})</h1>
      <AdvancedDataTable
        columns={columns}
        data={tickets as Record<string, unknown>[]}
        keyField="id"
        searchPlaceholder="Search tickets..."
        emptyTitle="No support tickets"
        emptyDescription="Tickets will appear here when users submit them."
        rowHref={(t) => `/owner/support/${t.id as string}`}
        rowActions={(t) => <Link href={`/owner/support/${t.id as string}`} className="text-brand text-xs hover:underline">View</Link>}
        filters={
          <div className="flex gap-1">{["OPEN","IN_PROGRESS","WAITING_ON_USER","RESOLVED","CLOSED"].map((s) => <Link key={s} href={`/owner/support?status=${s}`}><Badge variant="outline" className="cursor-pointer rounded-lg text-[10px]">{s.replace(/_/g, " ")}</Badge></Link>)}</div>
        }
      />
    </div>
  )
}
