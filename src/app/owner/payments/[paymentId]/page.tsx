import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerNotes } from "@/lib/services/owner-permission.service"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default async function OwnerPaymentDetailPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const session = await auth(); if (!session?.user?.id) notFound()
  const { paymentId } = await params
  const tx = await prisma.paymentTransaction.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, name: true, email: true } }, plan: { select: { name: true } }, subscription: true },
  })
  if (!tx) notFound()
  const notes = await getOwnerNotes("PAYMENT", paymentId).catch(() => [])

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Owner", href: "/owner" }, { label: "Payments", href: "/owner/payments" }, { label: tx.merchantReference || "Payment" }]} />
      <div className="flex items-center gap-4"><Button render={<Link href="/owner/payments" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button><h1 className="text-2xl font-bold tracking-tight">Payment</h1></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">User</span><Link href={`/owner/users/${tx.user.id}`} className="font-medium hover:underline">{tx.user.name || tx.user.email}</Link></div>
            <div><span className="text-muted-foreground">Plan</span><p className="font-medium">{tx.plan.name}</p></div>
            <div><span className="text-muted-foreground">Amount</span><p className="font-bold font-mono">R{Number(tx.amount).toLocaleString()}</p></div>
            <div><span className="text-muted-foreground">Currency</span><p className="font-medium">{tx.currency}</p></div>
            <div><span className="text-muted-foreground">Provider</span><p className="font-medium">{tx.provider}</p></div>
            <div><span className="text-muted-foreground">Status</span><Badge variant="outline" className={tx.status === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tx.status === "FAILED" ? "border-red-200 bg-red-50 text-red-700" : ""}>{tx.status}</Badge></div>
            <div className="col-span-2"><span className="text-muted-foreground">Merchant Ref</span><p className="font-mono text-xs">{tx.merchantReference}</p></div>
            {tx.providerReference && <div className="col-span-2"><span className="text-muted-foreground">Provider Ref</span><p className="font-mono text-xs">{tx.providerReference}</p></div>}
            {tx.paidAt && <div><span className="text-muted-foreground">Paid At</span><p className="font-medium">{new Date(tx.paidAt).toLocaleString()}</p></div>}
            {tx.failedAt && <div><span className="text-muted-foreground">Failed At</span><p className="font-medium">{new Date(tx.failedAt).toLocaleString()}</p></div>}
            <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(tx.createdAt).toLocaleString()}</p></div>
          </CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader><CardContent className="space-y-2">
            <form action={async () => { "use server"; await prisma.paymentTransaction.update({ where: { id: paymentId }, data: { metadata: { reviewedAt: new Date().toISOString(), reviewedBy: session.user.id } as any } }) }}><Button type="submit" size="sm" className="w-full rounded-xl">Mark Reviewed</Button></form>
            <form action={async () => { "use server"; await prisma.paymentTransaction.update({ where: { id: paymentId }, data: { status: "FAILED" } }) }}><Button type="submit" size="sm" variant="outline" className="w-full rounded-xl text-red-600">Mark Failed</Button></form>
            <Button size="sm" variant="outline" disabled className="w-full rounded-xl">Refund (coming soon)</Button>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Notes ({notes.length})</CardTitle></CardHeader><CardContent>{notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : notes.map((n) => (<div key={n.id} className="text-sm border-b pb-2 mb-2"><p>{n.note}</p><p className="text-xs text-muted-foreground">{n.admin.name} · {new Date(n.createdAt).toLocaleString()}</p></div>))}</CardContent></Card>
        </div>
      </div>
    </div>
  )
}
