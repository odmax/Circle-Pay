import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Globe, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function BulkOperationsPage() {
  await requireOwnerPage(PERMISSIONS.BULK_OPERATIONS_RUN)
  let recentOps: any[] = []
  try {
    recentOps = await prisma.bulkOperation.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { admin: { select: { name: true } } } })
  } catch {
    recentOps = []
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Bulk Operations</h1><p className="text-muted-foreground">Manage circles and users at scale</p></div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bulk Circles */}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="size-4" /> Bulk Circles</CardTitle></CardHeader><CardContent className="space-y-3">
          <form className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select name="type" className="rounded-xl border px-3 py-1.5 text-sm"><option value="">All Types</option>{["STOKVEL","SAVINGS","CHURCH","INVESTMENT","FAMILY","TRAVEL","HOUSEMATE","WEDDING","CUSTOM"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <select name="visibility" className="rounded-xl border px-3 py-1.5 text-sm"><option value="">All Visibility</option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="submit" size="sm" variant="outline" className="rounded-xl">Export CSV</Button>
              <Button size="sm" variant="outline" className="rounded-xl text-amber-600" disabled={true}>Feature Selected</Button>
              <Button size="sm" variant="outline" className="rounded-xl text-red-600" disabled={true}>Deactivate</Button>
            </div>
            <p className="text-xs text-muted-foreground">Bulk deactivation requires SUPER_ADMIN and confirmation.</p>
          </form>
        </CardContent></Card>

        {/* Bulk Users */}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Bulk Users</CardTitle></CardHeader><CardContent className="space-y-3">
          <form className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select name="plan" className="rounded-xl border px-3 py-1.5 text-sm"><option value="">All Plans</option><option value="free">Free</option><option value="premium">Premium</option><option value="community">Community</option></select>
              <select name="status" className="rounded-xl border px-3 py-1.5 text-sm"><option value="">All Status</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="submit" size="sm" variant="outline" className="rounded-xl">Export CSV</Button>
              <Button size="sm" variant="outline" className="rounded-xl text-red-600" disabled={true}>Suspend</Button>
              <Button size="sm" variant="outline" className="rounded-xl text-emerald-600" disabled={true}>Reactivate</Button>
            </div>
            <p className="text-xs text-muted-foreground">Bulk suspension/reactivation under development.</p>
          </form>
        </CardContent></Card>
      </div>

      {/* Safety Warning */}
      <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex items-center gap-3 p-4">
        <AlertTriangle className="size-5 text-red-500 shrink-0" />
        <div className="text-sm text-red-700"><p className="font-medium">Safety rules</p><p>No hard deletes. Destructive actions require confirmation text "CONFIRM". Bulk operations limited to 500 records. All actions logged.</p></div>
      </CardContent></Card>

      {/* Recent Operations */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Recent Bulk Operations</CardTitle></CardHeader><CardContent>
        {recentOps.length === 0 ? <p className="text-sm text-muted-foreground">No bulk operations yet</p> : (
          <div className="space-y-2">{recentOps.map((op) => (
            <div key={op.id} className="flex items-center justify-between text-sm border-b pb-2">
              <div><span className="font-medium capitalize">{op.type.toLowerCase()} {op.target.toLowerCase()}s</span><span className="text-muted-foreground ml-2">by {op.admin?.name || "System"}</span></div>
              <div className="flex items-center gap-3"><Badge variant="outline" className={op.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "text-[10px]"}>{op.status}</Badge><span className="text-xs text-muted-foreground">{op.successCount}/{op.targetCount} succeeded</span><span className="text-xs text-muted-foreground">{new Date(op.createdAt).toLocaleDateString()}</span></div>
            </div>
          ))}</div>
        )}
      </CardContent></Card>
    </div>
  )
}
