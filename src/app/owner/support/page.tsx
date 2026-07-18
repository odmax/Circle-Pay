import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { OwnerSupportTable, type SupportTicketRow } from "@/components/owner/owner-support-table"

export default async function OwnerSupportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireOwnerPage(PERMISSIONS.SUPPORT_MANAGE)
  const params = await searchParams
  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.category) where.category = params.category

  let tickets: SupportTicketRow[] = []
  try {
    tickets = (await prisma.supportTicket.findMany({
      where: where as any,
      include: { user: { select: { name: true, email: true } }, circle: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })).map((t) => ({
      id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, category: t.category,
      status: t.status, priority: t.priority || "MEDIUM",
      user: { name: t.user?.name || null, email: t.user?.email || null },
      createdAt: t.createdAt.toISOString(),
    })) as SupportTicketRow[]
  } catch (err) {
    console.error("OWNER_SUPPORT_QUERY_FAILED", err instanceof Error ? err.message : String(err))
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Could not load support tickets</h2><p className="text-sm text-muted-foreground mt-1">The ticket list could not be retrieved. This may be temporary.</p></div>
          <a href="/owner/support" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><RefreshCw className="size-4" /> Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/support", itemCount: tickets.length })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Support ({tickets.length})</h1>
      <OwnerSupportTable tickets={tickets} />
    </div>
  )
}
