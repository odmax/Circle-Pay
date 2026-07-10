import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getOwnerUserDetail, getOwnerNotes } from "@/lib/services/owner-permission.service"
import { prisma } from "@/lib/prisma"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default async function OwnerCircleDetailPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) notFound()
  const { circleId } = await params
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, include: { createdBy: { select: { name: true, email: true } }, _count: { select: { members: true, contributions: true, expenses: true } }, verification: true, reputation: true } })
  if (!circle) notFound()
  const notes = await getOwnerNotes("CIRCLE", circleId).catch(() => [])

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Owner", href: "/owner" }, { label: "Circles", href: "/owner/circles" }, { label: circle.name }]} />
      <div className="flex items-center gap-4">
        <Button render={<Link href="/owner/circles" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <h1 className="text-2xl font-bold tracking-tight">{circle.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Type</span><p className="font-medium">{circle.type}</p></div>
            <div><span className="text-muted-foreground">Visibility</span><p className="font-medium">{circle.visibility}</p></div>
            <div><span className="text-muted-foreground">Currency</span><p className="font-medium">{circle.currency}</p></div>
            <div><span className="text-muted-foreground">Country</span><p className="font-medium">{circle.country || "—"}</p></div>
            <div><span className="text-muted-foreground">City</span><p className="font-medium">{circle.city || "—"}</p></div>
            <div><span className="text-muted-foreground">Created by</span><p className="font-medium">{circle.createdBy?.name || circle.createdBy?.email}</p></div>
            <div><span className="text-muted-foreground">Members</span><p className="font-medium">{circle._count.members}</p></div>
            <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(circle.createdAt).toLocaleDateString()}</p></div>
            <div className="col-span-2"><span className="text-muted-foreground">Public Description</span><p className="font-medium">{circle.publicDescription || "—"}</p></div>
            <div className="col-span-2"><span className="text-muted-foreground">Rules</span><p className="font-medium whitespace-pre-wrap">{circle.rules || "—"}</p></div>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Stats</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold">{circle._count.contributions}</p><p className="text-xs text-muted-foreground">Contributions</p></div>
            <div><p className="text-2xl font-bold">{circle._count.expenses}</p><p className="text-xs text-muted-foreground">Expenses</p></div>
            <div><p className="text-2xl font-bold">{circle._count.members}</p><p className="text-xs text-muted-foreground">Members</p></div>
          </CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Verification</CardTitle></CardHeader><CardContent className="text-sm">
            <Badge variant="outline" className={circle.verification?.status === "VERIFIED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : circle.verification?.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>{circle.verification?.status || "NOT_SUBMITTED"}</Badge>
          </CardContent></Card>

          {circle.reputation && (
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Reputation</CardTitle></CardHeader><CardContent className="text-center"><p className="text-3xl font-bold">{circle.reputation.score}</p><p className="text-xs text-muted-foreground">out of 100</p></CardContent></Card>
          )}

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Notes ({notes.length})</CardTitle></CardHeader><CardContent>{notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : notes.map((n) => (
            <div key={n.id} className="text-sm border-b pb-2 mb-2"><p>{n.note}</p><p className="text-xs text-muted-foreground">{n.admin.name} · {new Date(n.createdAt).toLocaleString()}</p></div>
          ))}</CardContent></Card>

          <Card className="rounded-2xl border-red-200"><CardHeader><CardTitle className="text-base text-red-600">Danger Zone</CardTitle></CardHeader><CardContent>
            {circle.isActive ? (
              <form action={async () => { "use server"; const { prisma } = await import("@/lib/prisma"); await prisma.circle.update({ where: { id: circleId }, data: { isActive: false, deletedAt: new Date() } }) }}>
                <Button type="submit" variant="outline" className="w-full rounded-xl text-red-600 border-red-200">Deactivate Circle</Button>
              </form>
            ) : (
              <form action={async () => { "use server"; const { prisma } = await import("@/lib/prisma"); await prisma.circle.update({ where: { id: circleId }, data: { isActive: true, deletedAt: null } }) }}>
                <Button type="submit" variant="outline" className="w-full rounded-xl text-emerald-600 border-emerald-200">Reactivate Circle</Button>
              </form>
            )}
          </CardContent></Card>
        </div>
      </div>
    </div>
  )
}
