import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { prisma } from "@/lib/prisma"
import { Send, Megaphone, AlertTriangle } from "lucide-react"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function OwnerBroadcastsPage() {
  await requireOwnerPage(PERMISSIONS.BROADCAST_SEND)
  let broadcasts: any[] = []
  let queryError = false
  try {
    broadcasts = await prisma.platformBroadcast.findMany({ include: { createdBy: { select: { name: true } }, _count: { select: { recipients: true } } }, orderBy: { createdAt: "desc" }, take: 20 })
  } catch (err) {
    console.error("OWNER_BROADCASTS_QUERY_FAILED", err instanceof Error ? err.message : String(err))
    queryError = true
    broadcasts = []
  }

  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/broadcasts", itemCount: broadcasts.length, queryError })

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Broadcasts</h1><p className="text-muted-foreground">Send announcements to users</p></div>

      {queryError && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="size-5 text-amber-500 shrink-0" />
          <div className="text-sm text-amber-700"><p className="font-medium">Could not load recent broadcasts</p><p className="text-xs text-amber-600 mt-0.5">The broadcast list could not be retrieved. You can still create new broadcasts below.</p></div>
        </CardContent></Card>
      )}

      {/* Recent Broadcasts */}
      {!queryError && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Recent ({broadcasts.length})</CardTitle></CardHeader><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Title</th><th className="p-3">Type</th><th className="p-3">Target</th><th className="p-3">Status</th><th className="p-3">Recipients</th><th className="p-3">Date</th></tr></thead>
            <tbody>{broadcasts.map((b) => (
              <tr key={b.id} className="border-b"><td className="p-3 pl-4 font-medium">{b.title}</td><td className="p-3"><Badge variant="outline" className="text-[10px]">{b.type.replace(/_/g, " ")}</Badge></td><td className="p-3"><Badge variant="outline" className="text-[10px]">{b.target.replace(/_/g, " ")}</Badge></td><td className="p-3"><Badge variant="outline" className={b.status === "SENT" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : b.status === "DRAFT" ? "text-[10px]" : "text-[10px]"}>{b.status}</Badge></td><td className="p-3">{b.recipientCount || b._count.recipients}</td><td className="p-3 text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</td></tr>
            ))}</tbody>
          </table>
          {broadcasts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No broadcasts yet</p>}
        </CardContent></Card>
      )}

      {/* Create Form */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base"><Megaphone className="size-4 inline mr-1" /> Create Broadcast</CardTitle></CardHeader><CardContent>
        <form action={async (fd) => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("BROADCAST_SEND"); const target = fd.get("target") as string; const type = fd.get("type") as string; const title = fd.get("title") as string; const message = fd.get("message") as string; const sendNow = fd.get("sendNow") === "on";

          const users = await prisma.user.findMany({ select: { id: true }, take: sendNow ? 500 : 0 })
          const broadcast = await prisma.platformBroadcast.create({
            data: { createdById: "owner", title, message, type: (type as any) || "ANNOUNCEMENT", target: (target as any) || "ALL_USERS", status: sendNow ? "SENT" : "DRAFT", sentAt: sendNow ? new Date() : null, recipientCount: sendNow ? users.length : 0 }
          })
          if (sendNow) {
            await prisma.platformBroadcastRecipient.createMany({ data: users.map((u) => ({ broadcastId: broadcast.id, userId: u.id })) })
            await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: "CONTRIBUTION_REMINDER" as any, title: `📢 ${title}`, message })), skipDuplicates: true }).catch(() => {})
          }
        }} className="space-y-3">
          <Input name="title" placeholder="Broadcast title" className="rounded-xl" required />
          <Textarea name="message" placeholder="Message to users" className="rounded-xl" rows={3} required />
          <div className="grid grid-cols-3 gap-3">
            <select name="type" className="rounded-xl border px-3 py-2 text-sm"><option value="ANNOUNCEMENT">Announcement</option><option value="MAINTENANCE">Maintenance</option><option value="FEATURE_UPDATE">Feature Update</option><option value="BILLING">Billing</option><option value="SECURITY">Security</option><option value="PROMOTION">Promotion</option></select>
            <select name="target" className="rounded-xl border px-3 py-2 text-sm"><option value="ALL_USERS">All Users</option><option value="FREE_USERS">Free Users</option><option value="PREMIUM_USERS">Premium</option><option value="COMMUNITY_USERS">Community</option><option value="COUNTRY">By Country</option><option value="CIRCLE_TYPE">By Circle Type</option></select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sendNow" /> Send now</label>
          </div>
          <Button type="submit" className="rounded-xl bg-brand hover:bg-brand-600"><Send className="size-4 mr-1" /> {`Create & Send`}</Button>
        </form>
      </CardContent></Card>
    </div>
  )
}
