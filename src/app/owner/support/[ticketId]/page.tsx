import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/prisma"
import { getOwnerNotes } from "@/lib/services/owner-permission.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function OwnerTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  await requireOwnerPage(PERMISSIONS.SUPPORT_MANAGE)
  const { ticketId } = await params
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId }, include: { user: { select: { id: true, name: true, email: true } }, circle: { select: { id: true, name: true } }, messages: { include: { sender: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } } },
  })
  if (!ticket) notFound()
  const notes = await getOwnerNotes("SUPPORT", ticketId).catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Button render={<Link href="/owner/support" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button><h1 className="text-2xl font-bold tracking-tight">{ticket.subject}</h1></div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs">{ticket.ticketNumber}</span>
        <Link href={`/owner/users/${ticket.userId}`} className="text-brand hover:underline">{ticket.user?.name || ticket.user?.email}</Link>
        {ticket.circle && <Link href={`/owner/circles/${ticket.circle.id}`} className="text-brand hover:underline">({ticket.circle.name})</Link>}
        <Badge variant="outline">{ticket.category.replace(/_/g, " ")}</Badge>
        <Badge variant="outline" className={ticket.priority === "URGENT" ? "border-red-200 bg-red-50 text-red-700" : ticket.priority === "HIGH" ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>{ticket.priority}</Badge>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <Card key={m.id} className={`rounded-2xl ${m.isInternalNote ? "border-amber-200 bg-amber-50/10" : m.senderId === ticket.userId ? "border-brand-200 bg-brand-50/10" : "border-border/40"}`}>
            <CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-sm">{m.sender?.name || m.sender?.email}</span>{m.isInternalNote && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Internal Note</Badge>}<span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span></div><p className="text-sm whitespace-pre-wrap">{m.message}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="rounded-2xl"><CardContent className="p-4">
            <form action={async (fd) => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("SUPPORT_MANAGE"); const msg = fd.get("message") as string; const isInternal = fd.get("isInternal") === "on"; if (msg) { await prisma.supportTicketMessage.create({ data: { ticketId, senderId: "system", message: msg, isInternalNote: isInternal } }) } }} className="space-y-2">
              <textarea name="message" className="w-full rounded-xl border px-3 py-2 text-sm resize-none" rows={3} placeholder="Reply..." required />
              <div className="flex items-center gap-3"><label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="isInternal" /> Internal note</label><Button type="submit" className="rounded-xl bg-brand hover:bg-brand-600 text-sm">Send</Button></div>
            </form>
          </CardContent></Card>
        </div>
        <div className="space-y-3">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader><CardContent className="space-y-2">
            <form action={async (fd) => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("SUPPORT_MANAGE"); const status = fd.get("status") as string; await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: status as any, ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}) } }) }} className="flex gap-2">
              <select name="status" className="rounded-xl border px-2 py-1 text-xs flex-1"><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option><option value="WAITING_ON_USER">Waiting on User</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select>
              <Button type="submit" size="sm" className="rounded-xl text-xs">Update</Button>
            </form>
            <form action={async (fd) => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("SUPPORT_MANAGE"); await prisma.supportTicket.update({ where: { id: ticketId }, data: { priority: fd.get("priority") as any } }) }} className="flex gap-2">
              <select name="priority" className="rounded-xl border px-2 py-1 text-xs flex-1"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
              <Button type="submit" size="sm" className="rounded-xl text-xs">Update</Button>
            </form>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent>{notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : notes.map((n) => (<div key={n.id} className="text-sm border-b pb-2 mb-2"><p>{n.note}</p><p className="text-xs text-muted-foreground">{n.admin.name} · {new Date(n.createdAt).toLocaleString()}</p></div>))}</CardContent></Card>
        </div>
      </div>
    </div>
  )
}
