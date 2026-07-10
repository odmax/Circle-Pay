import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { prisma } from "@/lib/prisma"
import { Plus, Archive, RotateCcw, Copy, ExternalLink } from "lucide-react"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import Link from "next/link"

export default async function OwnerPlansPage() {
  await requireOwnerPage(PERMISSIONS.PLANS_MANAGE)
  const plans = await prisma.plan.findMany({ include: { _count: { select: { subscriptions: true } } }, orderBy: { sortOrder: "asc" } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold tracking-tight">Plans ({plans.length})</h1>
        <form action={async () => { "use server"; const { seedDefaultPlanFeatures } = await import("@/lib/services/feature-gate.service"); await seedDefaultPlanFeatures() }}><Button type="submit" size="sm" variant="outline" className="rounded-xl text-xs">Seed All Plan Features</Button></form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const features = (p.features as string[]) || []
          return (
            <Card key={p.id} className={`rounded-2xl ${p.isArchived ? "opacity-60" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </div>
                  <Badge variant="outline" className={p.isArchived ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{p.isArchived ? "Archived" : "Active"}</Badge>
                </div>

                <div className="text-2xl font-bold">{Number(p.price) === 0 ? "Free" : `R${Number(p.price).toLocaleString()}`}<span className="text-sm font-normal text-muted-foreground">/{p.interval.toLowerCase()}</span></div>

                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Circle limit: {p.circleLimit}</span>
                  <span>Currency: {p.currency}</span>
                  <span>Subscribers: {p._count.subscriptions}</span>
                </div>

                <ul className="space-y-1">{features.slice(0, 5).map((f: string, i: number) => <li key={i} className="text-xs flex items-start gap-1"><span className="text-brand">✓</span> {f}</li>)}</ul>
                {features.length > 5 && <p className="text-xs text-muted-foreground">+{features.length - 5} more</p>}

                <div className="flex gap-1 pt-2">
                  <Link href={`/owner/plans/${p.id}`}><Button size="sm" variant="outline" className="h-7 text-xs rounded-xl"><ExternalLink className="size-3 mr-1" /> View / Edit</Button></Link>
                  <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("PLANS_MANAGE"); await prisma.plan.update({ where: { id: p.id }, data: { isArchived: !p.isArchived } }) }}><Button type="submit" size="sm" variant="ghost" className="h-7 text-xs">{p.isArchived ? <RotateCcw className="size-3" /> : <Archive className="size-3" />}</Button></form>
                  <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("PLANS_MANAGE"); const { prisma } = await import("@/lib/prisma"); const original = await prisma.plan.findUnique({ where: { id: p.id } }); if (original) { await prisma.plan.create({ data: { ...original, id: undefined as any, slug: `${original.slug}-copy`, name: `${original.name} Copy`, isArchived: false, createdAt: undefined as any, updatedAt: undefined as any } as any }) } }}><Button type="submit" size="sm" variant="ghost" className="h-7 text-xs"><Copy className="size-3" /></Button></form>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Create Plan Form */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base"><Plus className="size-4 inline mr-1" /> Create Plan</CardTitle></CardHeader><CardContent>
        <form action={async (fd) => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("PLANS_MANAGE"); const features = fd.getAll("features").filter((f) => String(f).trim()).map((f) => String(f)); await prisma.plan.create({ data: { name: fd.get("name") as string, slug: fd.get("slug") as string, description: fd.get("description") as string || "", price: Number(fd.get("price") || 0), currency: (fd.get("currency") as string) || "ZAR", interval: (fd.get("interval") as any) || "MONTHLY", circleLimit: Number(fd.get("circleLimit") || 3), features: features as any, sortOrder: 99 } }) }} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input name="name" placeholder="Plan name" className="rounded-xl" required />
            <Input name="slug" placeholder="Slug (e.g. pro)" className="rounded-xl" required />
            <Input name="price" type="number" step="0.01" placeholder="Price (0 = free)" className="rounded-xl" />
            <Input name="circleLimit" type="number" placeholder="Circle limit" className="rounded-xl" defaultValue={3} />
          </div>
          <Input name="description" placeholder="Description" className="rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <select name="currency" className="rounded-xl border px-3 py-2 text-sm">{["ZAR","NGN","KES","GHS","USD","EUR","GBP"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select name="interval" className="rounded-xl border px-3 py-2 text-sm"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Features (one per line)</Label>
            <Textarea name="features" className="rounded-xl" rows={4} placeholder="Unlimited circles&#10;Priority support&#10;Export data" />
          </div>
          <Button type="submit" className="rounded-xl bg-brand hover:bg-brand-600">Create Plan</Button>
        </form>
      </CardContent></Card>
    </div>
  )
}
