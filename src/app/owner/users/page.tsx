import { getOwnerUsers } from "@/lib/services/owner.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { AdvancedDataTable, type Column } from "@/components/ui/app/advanced-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type UserRow = { id: string; name: string; email: string; phone: string | null; plan: string; circleCount: number; createdAt: string }

export default async function OwnerUsersPage() {
  await requireOwnerPage(PERMISSIONS.USERS_VIEW)

  let users: UserRow[] = []
  try {
    users = (await getOwnerUsers()) as unknown as UserRow[]
  } catch (err) {
    console.error("OWNER_USERS_QUERY_FAILED", err instanceof Error ? err.message : String(err))
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Could not load users</h2><p className="text-sm text-muted-foreground mt-1">The user list could not be retrieved. This may be temporary.</p></div>
          <a href="/owner/users" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><RefreshCw className="size-4" /> Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  const columns: Column<UserRow>[] = [
    { key: "name", header: "Name", accessor: (u) => <span className="font-medium">{u.name || "—"}</span>, sortable: true },
    { key: "email", header: "Email", sortable: true },
    { key: "phone", header: "Phone", hideOnMobile: true },
    { key: "plan", header: "Plan", accessor: (u) => <Badge variant="outline" className="text-[10px]">{u.plan}</Badge> },
    { key: "circleCount", header: "Circles", sortable: true, hideOnMobile: true },
    { key: "createdAt", header: "Joined", accessor: (u) => new Date(u.createdAt).toLocaleDateString(), sortable: true },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Users ({users.length})</h1>
      <AdvancedDataTable
        columns={columns}
        data={users}
        keyField="id"
        searchPlaceholder="Search users..."
        emptyTitle="No users yet"
        emptyDescription="Users will appear here after signing up."
        rowHref={(u) => `/owner/users/${u.id}`}
        rowActions={(u) => <Link href={`/owner/users/${u.id}`} className="text-brand text-xs hover:underline">Manage</Link>}
        bulkActions={["Add Note", "Export Selected"]}
        exportHref="/api/owner/revenue/export.csv"
      />
    </div>
  )
}
