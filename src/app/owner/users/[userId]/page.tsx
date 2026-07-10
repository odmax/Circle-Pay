import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { OwnerUserCircleManager } from "@/components/owner/owner-user-circle-manager"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerNotes } from "@/lib/services/owner-permission.service"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default async function OwnerUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth(); if (!session?.user?.id) notFound()
  const { userId } = await params
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })
  if (!admin?.isActive) notFound()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: { include: { plan: { select: { name: true, slug: true } } } },
      _count: { select: { circleMembers: true } },
      paymentTransactions: { take: 5, orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } } },
      internalAdmin: true,
      circleMembers: { include: { circle: { select: { id: true, name: true, type: true } } } },
    },
  })
  if (!user) notFound()
  const notes = await getOwnerNotes("USER", userId).catch(() => [])
  const plans = await prisma.plan.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true } })
  const allCircles = await prisma.circle.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, type: true }, take: 50 })

  const init = user.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
  const sub = user.subscription
  const isSuperAdmin = admin.role === "SUPER_ADMIN"
  const userIsAdmin = !!user.internalAdmin
  const canManage = isSuperAdmin || admin.role === "ADMIN"

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Owner", href: "/owner" }, { label: "Users", href: "/owner/users" }, { label: user.name || user.email }]} />
      <div className="flex items-center gap-4"><Button render={<Link href="/owner/users" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button><h1 className="text-2xl font-bold tracking-tight">User Detail</h1></div>

      {'notFound' in user ? <p>Not found</p> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Profile */}
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader><CardContent className="flex items-start gap-4">
              <Avatar className="size-16"><AvatarFallback className="text-xl bg-brand-100 text-brand-700">{init}</AvatarFallback></Avatar>
              <div className="flex-1 space-y-3">
                <form action={async (fd) => { "use server"; const { prisma } = await import("@/lib/prisma"); await prisma.user.update({ where: { id: userId }, data: { name: fd.get("name") as string, email: fd.get("email") as string, phone: fd.get("phone") as string || null, currency: fd.get("currency") as string } }) }}>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="name" defaultValue={user.name || ""} className="rounded-xl border px-3 py-1.5 text-sm" placeholder="Name" />
                    <input name="email" defaultValue={user.email} className="rounded-xl border px-3 py-1.5 text-sm" placeholder="Email" />
                    <input name="phone" defaultValue={user.phone || ""} className="rounded-xl border px-3 py-1.5 text-sm" placeholder="Phone" />
                    <select name="currency" defaultValue={user.currency} className="rounded-xl border px-3 py-1.5 text-sm">
                      {["NGN","KES","GHS","ZAR","USD","EUR","GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {canManage && <Button type="submit" size="sm" className="rounded-xl mt-2">Save</Button>}
                </form>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Joined</span><span>{new Date(user.createdAt).toLocaleDateString()}</span>
                  {user.isSuspended && <Badge className="bg-red-500">Suspended</Badge>}
                  {user.internalAdmin && <Badge className="bg-amber-500">{user.internalAdmin.role}</Badge>}
                </div>
              </div>
            </CardContent></Card>

            {/* Circles */}
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Circles ({user.circleMembers.length})</CardTitle></CardHeader><CardContent>
              <OwnerUserCircleManager userId={userId} circles={user.circleMembers} allCircles={allCircles.map((c) => ({ id: c.id, name: c.name, type: c.type }))} canManage={canManage} />
            </CardContent></Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Plan */}
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Plan</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Current</span><span className="font-medium">{sub?.plan.name || "Free"}</span></div>
              <div className="flex justify-between"><span>Status</span><Badge variant="outline" className={sub?.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{sub?.status || "NONE"}</Badge></div>
              {sub && <div className="flex justify-between"><span>Ends</span><span>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span></div>}
              {canManage && (
                <form action={async (fd) => { "use server"; const slug = fd.get("planSlug") as string; const plan = await prisma.plan.findUnique({ where: { slug } }); if (plan) { const now = new Date(); await prisma.userSubscription.upsert({ where: { userId }, create: { userId, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth()+1, now.getDate()) }, update: { planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth()+1, now.getDate()) } }) } }} className="flex gap-2 mt-2">
                  <select name="planSlug" className="rounded-xl border px-2 py-1 text-xs flex-1">{plans.map((p) => <option key={p.id} value={p.slug} selected={p.slug === sub?.plan.slug}>{p.name}</option>)}</select>
                  <Button type="submit" size="sm" className="rounded-xl text-xs">Change</Button>
                </form>
              )}
            </CardContent></Card>

            {/* Danger */}
            <Card className="rounded-2xl border-red-200"><CardHeader><CardTitle className="text-base text-red-600">Danger Zone</CardTitle></CardHeader><CardContent className="space-y-2">
              {canManage && !userIsAdmin && (
                user.isSuspended ? (
                  <form action={async () => { "use server"; await prisma.user.update({ where: { id: userId }, data: { isSuspended: false, suspendedAt: null } }) }}><Button type="submit" size="sm" variant="outline" className="w-full rounded-xl text-emerald-600">Reactivate</Button></form>
                ) : (
                  <form action={async () => { "use server"; await prisma.user.update({ where: { id: userId }, data: { isSuspended: true, suspendedAt: new Date() } }) }}><Button type="submit" size="sm" variant="outline" className="w-full rounded-xl text-red-600">Suspend</Button></form>
                )
              )}
            </CardContent></Card>

            {/* Notes */}
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Notes ({notes.length})</CardTitle></CardHeader><CardContent>{notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : notes.map((n) => (<div key={n.id} className="text-sm border-b pb-2 mb-2"><p>{n.note}</p><p className="text-xs text-muted-foreground">{n.admin.name} · {new Date(n.createdAt).toLocaleString()}</p></div>))}</CardContent></Card>
          </div>
        </div>
      )}
    </div>
  )
}
