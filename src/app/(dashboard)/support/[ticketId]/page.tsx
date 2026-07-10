import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) notFound()
  const { ticketId } = await params
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId }, include: { user: { select: { name: true, email: true } }, messages: { include: { sender: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } } },
  })
  if (!ticket || ticket.userId !== session.user.id) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Button render={<Link href="/support" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button><h1 className="text-2xl font-bold tracking-tight">{ticket.subject}</h1></div>

      <div className="flex items-center gap-2 text-sm"><Badge variant="outline">{ticket.category.replace(/_/g, " ")}</Badge><Badge variant="outline" className={ticket.status === "OPEN" ? "border-amber-200 bg-amber-50 text-amber-700" : ticket.status === "RESOLVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{ticket.status}</Badge><span className="text-muted-foreground">{ticket.ticketNumber}</span></div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <Card key={m.id} className={`rounded-2xl ${m.senderId === session.user.id ? "border-brand-200 bg-brand-50/10" : "border-border/40"}`}>
            <CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-sm">{m.sender?.name || m.sender?.email}</span>{m.isInternalNote && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Internal Note</Badge>}<span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span></div><p className="text-sm whitespace-pre-wrap">{m.message}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl"><CardContent className="p-4">
        <form action={async (fd) => { "use server"; const msg = fd.get("message") as string; if (msg) { await prisma.supportTicketMessage.create({ data: { ticketId, senderId: session.user.id!, message: msg } }) } }} className="flex gap-2">
          <textarea name="message" className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none" rows={2} placeholder="Reply..." required />
          <Button type="submit" className="rounded-xl bg-brand hover:bg-brand-600 shrink-0">Send</Button>
        </form>
      </CardContent></Card>
    </div>
  )
}
