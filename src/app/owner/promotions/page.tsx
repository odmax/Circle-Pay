import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { prisma } from "@/lib/prisma"
import { Plus, Power, PowerOff } from "lucide-react"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function OwnerPromotionsPage() {
  await requireOwnerPage(PERMISSIONS.PROMOS_MANAGE)
  const promos = await prisma.promoCode.findMany({ include: { _count: { select: { redemptions: true } } }, orderBy: { createdAt: "desc" } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold tracking-tight">Promotions ({promos.length})</h1></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promos.map((p) => {
          const plans = (p.appliesToPlanIds as string[]) || []
          return (
            <Card key={p.id} className={`rounded-2xl ${!p.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2"><code className="text-lg font-mono font-bold text-brand">{p.code}</code><Badge variant="outline" className={p.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "text-[10px]"}>{p.isActive ? "Active" : "Inactive"}</Badge></div>
                    <p className="text-sm font-medium">{p.name}</p>
                  </div>
                  <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("PROMOS_MANAGE"); await prisma.promoCode.update({ where: { id: p.id }, data: { isActive: !p.isActive } }) }}><Button type="submit" size="sm" variant="ghost" className="h-7">{p.isActive ? <PowerOff className="size-3 text-red-500" /> : <Power className="size-3 text-emerald-500" />}</Button></form>
                </div>
                <div className="text-xl font-bold text-emerald-600">{p.discountType === "PERCENTAGE" ? `${Number(p.discountValue)}% OFF` : p.discountType === "FIXED_AMOUNT" ? `R${Number(p.discountValue)} OFF` : `${Number(p.discountValue)} trial days`}</div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Redemptions: {p._count.redemptions}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}</span>
                  <span>{p.discountType.replace(/_/g, " ")}</span>
                  {p.startsAt && <span>Starts: {new Date(p.startsAt).toLocaleDateString()}</span>}
                  {p.endsAt && <span>Ends: {new Date(p.endsAt).toLocaleDateString()}</span>}
                </div>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                {plans.length > 0 && <div className="flex flex-wrap gap-1">{plans.map((pid: string) => <Badge key={pid} variant="outline" className="text-[10px]">{pid}</Badge>)}</div>}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Create Form */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base"><Plus className="size-4 inline mr-1" /> Create Promo Code</CardTitle></CardHeader><CardContent>
        <form action={async (fd) => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("PROMOS_MANAGE"); await prisma.promoCode.create({ data: { code: (fd.get("code") as string).toUpperCase(), name: fd.get("name") as string, description: fd.get("description") as string || null, discountType: (fd.get("discountType") as any) || "PERCENTAGE", discountValue: Number(fd.get("discountValue") || 10), maxRedemptions: Number(fd.get("maxRedemptions") || 0) || null, createdById: "owner" } }) }} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input name="code" placeholder="Code (e.g. LAUNCH50)" className="rounded-xl" required />
            <Input name="name" placeholder="Campaign name" className="rounded-xl" required />
            <select name="discountType" className="rounded-xl border px-3 py-2 text-sm"><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed Amount</option><option value="FREE_TRIAL_DAYS">Free Trial Days</option></select>
            <Input name="discountValue" type="number" step="0.01" placeholder="Value" className="rounded-xl" defaultValue={10} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input name="maxRedemptions" type="number" placeholder="Max uses (blank = unlimited)" className="rounded-xl" />
            <Input name="startsAt" type="date" className="rounded-xl" />
            <Input name="endsAt" type="date" className="rounded-xl" />
          </div>
          <Input name="description" placeholder="Description" className="rounded-xl" />
          <Button type="submit" className="rounded-xl bg-brand hover:bg-brand-600">Create Promo Code</Button>
        </form>
      </CardContent></Card>
    </div>
  )
}
