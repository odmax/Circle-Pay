import { getOwnerAuditLogs } from "@/lib/services/audit.service"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

const actionIcons: Record<string, string> = {
  created: "\u2795", updated: "\u270f\ufe0f", deleted: "\ud83d\uddd1\ufe0f", added: "\ud83d\udc4b", removed: "\ud83d\udeab",
  contributed: "\ud83d\udcb0", allocated: "\ud83d\udce5", completed: "\ud83c\udfc6", confirmed: "\u2705", rejected: "\u274c",
}

export default async function OwnerAuditLogsPage() {
  await requireOwnerPage(PERMISSIONS.AUDIT_LOGS_VIEW)
  let logs: Awaited<ReturnType<typeof getOwnerAuditLogs>> = []
  try {
    logs = await getOwnerAuditLogs()
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Unable to load audit logs</h2><p className="text-sm text-muted-foreground mt-1">The audit logs could not be retrieved.</p></div>
          <a href="/owner/audit-logs" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Audit Logs ({logs.length})</h1>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="p-4">User</th><th className="p-4">Action</th><th className="p-4">Entity</th><th className="p-4">Circle</th><th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="p-4 font-medium">{l.user?.name || l.user?.email || "System"}</td>
                  <td className="p-4">{actionIcons[l.action] || "📌"} {l.action}</td>
                  <td className="p-4 text-muted-foreground">{l.entityType}</td>
                  <td className="p-4 text-muted-foreground">{l.circle?.name || "—"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No audit logs</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
