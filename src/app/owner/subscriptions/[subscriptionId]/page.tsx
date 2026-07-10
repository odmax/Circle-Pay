import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerNotes } from "@/lib/services/owner-permission.service"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default async function OwnerSubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const session = await auth(); if (!session?.user?.id) notFound()
  const { subscriptionId } = await params
  const sub = await prisma.userSubscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { id: true, name: true, email: true } }, plan: { select: { id: true, name: true, slug: true } }, transactions: { take: 10, orderBy: { createdAt: "desc" } } },
  })
  if (!sub) notFound()
  const notes = await getOwnerNotes("SUBSCRIPTION", subscriptionId).catch(() => [])
  const plans = await prisma.plan.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true } })

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Owner", href: "/owner" }, { label: "Subscriptions", href: "/owner/subscriptions" }, { label: sub.plan?.name || sub.user?.name || "Subscription" }]} />
      <div className="flex items-center gap-4"><Button render={<Link href="/owner/subscriptions" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button><h1 className="text-2xl font-bold tracking-tight">Subscription</h1></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">User</span><Link href={`/owner/users/${sub.user.id}`} className="font-medium hover:underline">{sub.user.name || sub.user.email}</Link></div>
            <div><span className="text-muted-foreground">Plan</span><p className="font-medium">{sub.plan.name}</p></div>
            <div><span className="text-muted-foreground">Status</span><Badge variant="outline" className={sub.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{sub.status}</Badge></div>
            <div><span className="text-muted-foreground">Period Start</span><p className="font-medium">{new Date(sub.currentPeriodStart).toLocaleDateString()}</p></div>
            <div><span className="text-muted-foreground">Period End</span><p className="font-medium">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</p></div>
            {sub.trialEndsAt && <div><span className="text-muted-foreground">Trial End</span><p className="font-medium">{new Date(sub.trialEndsAt).toLocaleDateString()}</p></div>}
            {sub.cancelledAt && <div><span className="text-muted-foreground">Cancelled</span><p className="font-medium">{new Date(sub.cancelledAt).toLocaleDateString()}</p></div>}
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader><CardContent>{sub.transactions.length === 0 ? <p className="text-sm text-muted-foreground">No payments</p> : sub.transactions.map((t) => (
            <Link key={t.id} href={`/owner/payments/${t.id}`} className="flex justify-between text-sm py-1 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded">
              <span>R{Number(t.amount).toLocaleString()}</span><Badge variant="outline" className="text-[10px]">{t.status}</Badge><span className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
            </Link>
          ))}</CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader><CardContent className="space-y-2">
            <form action={async (fd) => { "use server"; const { prisma } = await import("@/lib/prisma"); const plan = await prisma.plan.findUnique({ where: { slug: fd.get("planSlug") as string } }); if (plan) await prisma.userSubscription.update({ where: { id: subscriptionId }, data: { planId: plan.id } }) }}>
              <div className="flex gap-2">
                <select name="planSlug" className="rounded-xl border px-2 py-1 text-sm flex-1">{plans.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}</select>
                <Button type="submit" size="sm" className="rounded-xl">Change</Button>
              </div>
            </form>
            <form action={async () => { "use server"; const { prisma } = await import("@/lib/prisma"); const s = await prisma.userSubscription.findUnique({ where: { id: subscriptionId } }); if (s) await prisma.userSubscription.update({ where: { id: subscriptionId }, data: { currentPeriodEnd: new Date(new Date(s.currentPeriodEnd).getTime() + 30 * 24 * 60 * 60 * 1000) } }) }}>
              <Button type="submit" size="sm" variant="outline" className="w-full rounded-xl">Extend 30 Days</Button>
            </form>
            <form action={async () => { "use server"; await prisma.userSubscription.update({ where: { id: subscriptionId }, data: { status: "ACTIVE", cancelledAt: null } }) }}><Button type="submit" size="sm" variant="outline" className="w-full rounded-xl text-emerald-600">Reactivate</Button></form>
            <form action={async () => { "use server"; await prisma.userSubscription.update({ where: { id: subscriptionId }, data: { status: "CANCELLED", cancelledAt: new Date() } }) }}><Button type="submit" size="sm" variant="outline" className="w-full rounded-xl text-red-600">Cancel</Button></form>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Notes ({notes.length})</CardTitle></CardHeader><CardContent>{notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : notes.map((n) => (<div key={n.id} className="text-sm border-b pb-2 mb-2"><p>{n.note}</p><p className="text-xs text-muted-foreground">{n.admin.name} · {new Date(n.createdAt).toLocaleString()}</p></div>))}</CardContent></Card>
        </div>
      </div>
    </div>
  )
}
