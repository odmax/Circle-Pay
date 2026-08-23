"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Undo2,
  Settings,
  History,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RoleBadge } from "./role-badge"
import { useCirclePermissions } from "@/hooks/use-circle-permissions"
import {
  CIRCLE_PERMISSIONS,
  type CirclePermission,
} from "@/lib/permissions/circlePermissions"
import { getRoleDefaultPermissions } from "@/lib/permissions/circle-role-permissions"
import type { MemberRole } from "@/generated/prisma"
import { toast } from "sonner"

type MemberOverride = {
  id: string
  permission: CirclePermission
  granted: boolean
  grantedById: string | null
  createdAt: string
}

type SerializedMember = {
  id: string
  role: string
  joinedAt: string
  user: { id: string; name: string | null; email: string; image: string | null }
  overrides: MemberOverride[]
}

const PERMISSION_GROUPS: { label: string; permissions: CirclePermission[] }[] = [
  {
    label: "Circle Management",
    permissions: [
      CIRCLE_PERMISSIONS.CIRCLE_VIEW,
      CIRCLE_PERMISSIONS.CIRCLE_UPDATE,
      CIRCLE_PERMISSIONS.CIRCLE_DELETE,
      CIRCLE_PERMISSIONS.SETTINGS_MANAGE,
    ],
  },
  {
    label: "Member Management",
    permissions: [
      CIRCLE_PERMISSIONS.MEMBER_VIEW,
      CIRCLE_PERMISSIONS.MEMBER_INVITE,
      CIRCLE_PERMISSIONS.MEMBER_REMOVE,
      CIRCLE_PERMISSIONS.MEMBER_ROLE_UPDATE,
      CIRCLE_PERMISSIONS.MEMBER_PERMISSION_MANAGE,
      CIRCLE_PERMISSIONS.MEMBER_AUDIT_VIEW,
    ],
  },
  {
    label: "Contributions",
    permissions: [
      CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE,
      CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN,
      CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_OWN,
      CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL,
      CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW,
      CIRCLE_PERMISSIONS.CONTRIBUTION_REJECT,
      CIRCLE_PERMISSIONS.CONTRIBUTION_REFUND,
    ],
  },
  {
    label: "Expenses",
    permissions: [
      CIRCLE_PERMISSIONS.EXPENSE_CREATE,
      CIRCLE_PERMISSIONS.EXPENSE_VIEW,
      CIRCLE_PERMISSIONS.EXPENSE_APPROVE,
      CIRCLE_PERMISSIONS.EXPENSE_DELETE,
    ],
  },
  {
    label: "Settlements",
    permissions: [
      CIRCLE_PERMISSIONS.SETTLEMENT_CREATE,
      CIRCLE_PERMISSIONS.SETTLEMENT_VIEW,
      CIRCLE_PERMISSIONS.SETTLEMENT_CONFIRM,
    ],
  },
  {
    label: "Goals",
    permissions: [
      CIRCLE_PERMISSIONS.GOAL_CREATE,
      CIRCLE_PERMISSIONS.GOAL_UPDATE,
      CIRCLE_PERMISSIONS.GOAL_DELETE,
    ],
  },
  {
    label: "Ledger & Reports",
    permissions: [
      CIRCLE_PERMISSIONS.LEDGER_VIEW,
      CIRCLE_PERMISSIONS.LEDGER_ADJUST,
      CIRCLE_PERMISSIONS.REPORT_VIEW,
      CIRCLE_PERMISSIONS.REPORT_EXPORT,
    ],
  },
  {
    label: "Projects",
    permissions: [
      CIRCLE_PERMISSIONS.PROJECT_CREATE,
      CIRCLE_PERMISSIONS.PROJECT_VIEW,
      CIRCLE_PERMISSIONS.PROJECT_MANAGE,
      CIRCLE_PERMISSIONS.PROJECT_APPROVE,
    ],
  },
  {
    label: "Wallets & Payouts",
    permissions: [
      CIRCLE_PERMISSIONS.WALLET_VIEW,
      CIRCLE_PERMISSIONS.PAYOUT_REQUEST,
      CIRCLE_PERMISSIONS.PAYOUT_APPROVE,
    ],
  },
  {
    label: "Feed & Events",
    permissions: [
      CIRCLE_PERMISSIONS.FEED_POST,
      CIRCLE_PERMISSIONS.FEED_DELETE,
      CIRCLE_PERMISSIONS.FEED_PIN,
      CIRCLE_PERMISSIONS.EVENT_MANAGE,
      CIRCLE_PERMISSIONS.POLL_MANAGE,
    ],
  },
  {
    label: "Other",
    permissions: [
      CIRCLE_PERMISSIONS.JOIN_REQUEST_REVIEW,
      CIRCLE_PERMISSIONS.INVITE_MANAGE,
      CIRCLE_PERMISSIONS.AUTOMATION_MANAGE,
      CIRCLE_PERMISSIONS.WORKFLOW_MANAGE,
    ],
  },
]

type AuditEntry = {
  id: string
  action: string
  affectedUserId: string | null
  reason: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: string
  actor: { id: string; name: string | null; email: string; image: string | null } | null
  affectedUser: { id: string; name: string | null; email: string; image: string | null } | null
}

type AuditResponse = {
  entries: AuditEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CIRCLE_MEMBER_ROLE_CHANGED: "Role Changed",
  CIRCLE_MEMBER_PERMISSION_GRANTED: "Permission Granted",
  CIRCLE_MEMBER_PERMISSION_DENIED: "Permission Denied",
  CIRCLE_MEMBER_PERMISSION_OVERRIDE_REMOVED: "Override Removed",
  CIRCLE_MEMBER_REMOVED: "Member Removed",
  CIRCLE_OWNERSHIP_TRANSFERRED: "Ownership Transferred",
}

function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] || action.replace(/_/g, " ").toLowerCase()
}

function AuditHistorySection({
  circleId,
  members,
}: {
  circleId: string
  members: SerializedMember[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [filterMember, setFilterMember] = useState<string>("all")
  const [filterActor, setFilterActor] = useState<string>("all")
  const [filterAction, setFilterAction] = useState<string>("all")

  const fetchAuditHistory = useCallback(
    async (p: number, affUserId?: string, actUserId?: string, action?: string) => {
      setLoading(true)
      try {
        const url = new URL(`/api/circles/${circleId}/permissions/audit`, window.location.origin)
        url.searchParams.set("page", String(p))
        url.searchParams.set("pageSize", "20")
        if (affUserId && affUserId !== "all") url.searchParams.set("affectedUserId", affUserId)
        if (actUserId && actUserId !== "all") url.searchParams.set("actorUserId", actUserId)
        if (action && action !== "all") url.searchParams.set("action", action)

        const res = await fetch(url.toString())
        if (!res.ok) return
        const data: AuditResponse = await res.json()
        setEntries(data.entries)
        setTotal(data.total)
        setPage(data.page)
        setTotalPages(data.totalPages)
        setLoaded(true)
      } catch {
        toast.error("Failed to load audit history")
      } finally {
        setLoading(false)
      }
    },
    [circleId]
  )

  function handleLoad() {
    fetchAuditHistory(1, filterMember, filterActor, filterAction)
  }

  function handleFilterChange(type: "member" | "actor" | "action", value: string | null) {
    const v = value || "all"
    if (type === "member") setFilterMember(v)
    if (type === "actor") setFilterActor(v)
    if (type === "action") setFilterAction(v)
  }

  function handlePageChange(newPage: number) {
    fetchAuditHistory(newPage, filterMember, filterActor, filterAction)
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-brand" />
          <CardTitle className="text-base">Permission History</CardTitle>
        </div>
        <CardDescription>
          Audit trail for role changes, permission grants, denials, and overrides.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Member</label>
            <Select value={filterMember} onValueChange={(v) => handleFilterChange("member", v)}>
              <SelectTrigger className="h-8 w-40 text-xs rounded-lg">
                <span>{filterMember === "all" ? "All members" : members.find(m => m.user.id === filterMember)?.user.name || "Unknown"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user.id} value={m.user.id}>
                    {m.user.name || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Actor</label>
            <Select value={filterActor} onValueChange={(v) => handleFilterChange("actor", v)}>
              <SelectTrigger className="h-8 w-40 text-xs rounded-lg">
                <span>{filterActor === "all" ? "All actors" : members.find(m => m.user.id === filterActor)?.user.name || "Unknown"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user.id} value={m.user.id}>
                    {m.user.name || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Action</label>
            <Select value={filterAction} onValueChange={(v) => handleFilterChange("action", v)}>
              <SelectTrigger className="h-8 w-44 text-xs rounded-lg">
                <span>{filterAction === "all" ? "All actions" : formatAuditAction(filterAction)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={handleLoad}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : <History className="size-3 mr-1" />}
            Load History
          </Button>
        </div>

        {!loaded && !loading && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Click &ldquo;Load History&rdquo; to view the permission audit trail.
          </p>
        )}

        {loading && !loaded && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {loaded && entries.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No permission changes found for the selected filters.
          </p>
        )}

        {loaded && entries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {total} event{total !== 1 ? "s" : ""} found
            </p>

            <div className="space-y-1.5">
              {entries.map((entry) => {
                const oldVals = entry.oldValues as Record<string, unknown> | null
                const newVals = entry.newValues as Record<string, unknown> | null

                let detail = ""
                if (entry.action === "CIRCLE_MEMBER_ROLE_CHANGED") {
                  detail = `${oldVals?.role || "?"} → ${newVals?.role || "?"}`
                } else if (entry.action === "CIRCLE_MEMBER_PERMISSION_GRANTED" || entry.action === "CIRCLE_MEMBER_PERMISSION_DENIED") {
                  detail = newVals?.permission as string || ""
                } else if (entry.action === "CIRCLE_MEMBER_PERMISSION_OVERRIDE_REMOVED") {
                  detail = oldVals?.permission as string || ""
                } else if (entry.action === "CIRCLE_MEMBER_REMOVED") {
                  detail = `Was ${oldVals?.role || "member"}`
                }

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border border-border/40 p-2.5 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 h-4 ${
                            entry.action.includes("GRANTED")
                              ? "bg-emerald-100 text-emerald-700"
                              : entry.action.includes("DENIED") || entry.action.includes("REMOVED")
                                ? "bg-red-100 text-red-700"
                                : entry.action.includes("CHANGED")
                                  ? "bg-blue-100 text-blue-700"
                                  : ""
                          }`}
                        >
                          {formatAuditAction(entry.action)}
                        </Badge>
                        {detail && (
                          <span className="text-muted-foreground font-mono">{detail}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                        <span>
                          By{" "}
                          <span className="font-medium text-foreground">
                            {entry.actor?.name || entry.actor?.email || "Unknown"}
                          </span>
                        </span>
                        {entry.affectedUser && (
                          <span>
                            →{" "}
                            <span className="font-medium text-foreground">
                              {entry.affectedUser.name || entry.affectedUser.email}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="size-3 mr-1" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                >
                  Next <ChevronRight className="size-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatPermissionName(perm: string): string {
  return perm
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function CirclePermissionsManager({
  circleId,
  circleName,
  actorPermissions,
  members,
}: {
  circleId: string
  circleName: string
  actorPermissions: CirclePermission[]
  members: SerializedMember[]
}) {
  const router = useRouter()
  const { can } = useCirclePermissions(actorPermissions)

  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState<string | null>(null)
  const [permLoading, setPermLoading] = useState<string | null>(null)

  const canManageRoles = can(CIRCLE_PERMISSIONS.MEMBER_ROLE_UPDATE)
  const canManagePerms = can(CIRCLE_PERMISSIONS.MEMBER_PERMISSION_MANAGE)

  const getRoleDefaults = useCallback((role: string): CirclePermission[] => {
    return getRoleDefaultPermissions(role as MemberRole)
  }, [])

  const getEffectivePermissions = useCallback(
    (member: SerializedMember): CirclePermission[] => {
      const defaults = getRoleDefaults(member.role)
      const effective = new Set(defaults)
      for (const override of member.overrides) {
        if (override.granted) {
          effective.add(override.permission)
        } else {
          effective.delete(override.permission)
        }
      }
      return Array.from(effective)
    },
    [getRoleDefaults]
  )

  async function handleRoleChange(memberId: string, newRole: string, memberName: string) {
    const member = members.find(m => m.id === memberId)
    if (!member || member.role === newRole) return

    setRoleLoading(memberId)
    try {
      const res = await fetch(`/api/circles/${circleId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to update role")
        return
      }
      toast.success(`${memberName} is now ${newRole.charAt(0) + newRole.slice(1).toLowerCase()}`)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setRoleLoading(null)
    }
  }

  async function handleGrantPermission(
    membershipId: string,
    permission: CirclePermission,
    memberName: string
  ) {
    setPermLoading(`${membershipId}-${permission}`)
    try {
      const res = await fetch(`/api/circles/${circleId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, permission, granted: true }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to grant permission")
        return
      }
      toast.success(`Permission granted to ${memberName}`)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setPermLoading(null)
    }
  }

  async function handleDenyPermission(
    membershipId: string,
    permission: CirclePermission,
    memberName: string
  ) {
    setPermLoading(`${membershipId}-${permission}`)
    try {
      const res = await fetch(`/api/circles/${circleId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, permission, granted: false }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to deny permission")
        return
      }
      toast.success(`Permission denied for ${memberName}`)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setPermLoading(null)
    }
  }

  async function handleRemoveOverride(
    membershipId: string,
    permission: CirclePermission,
    memberName: string
  ) {
    setPermLoading(`${membershipId}-${permission}`)
    try {
      const res = await fetch(`/api/circles/${circleId}/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, permission }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to remove override")
        return
      }
      toast.success(`Override removed for ${memberName}`)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setPermLoading(null)
    }
  }

  function getPermStatus(
    member: SerializedMember,
    perm: CirclePermission
  ): "granted" | "denied" | "default" {
    const override = member.overrides.find(o => o.permission === perm)
    if (!override) return "default"
    return override.granted ? "granted" : "denied"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground">{circleName}</p>
      </div>

      <Card className="rounded-2xl border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            Manage roles and fine-tune permissions for each member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map(member => {
              const isExpanded = expandedMember === member.id
              const isOwner = member.role === "OWNER"
              const overrideCount = member.overrides.length
              const effectivePerms = getEffectivePermissions(member)
              const initials = member.user.name
                ? member.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                : "??"

              return (
                <div key={member.id} className="rounded-xl border border-border/40 bg-card">
                  <div
                    className="flex items-center gap-3 p-3"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={member.user.image || ""} />
                      <AvatarFallback className="bg-brand-50 text-brand-700 text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user.name || member.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.user.email}
                      </p>
                    </div>

                    <RoleBadge role={member.role as MemberRole} />

                    {overrideCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                      </Badge>
                    )}

                    {canManageRoles && !isOwner && (
                      <Select
                        value={member.role}
                        onValueChange={(v) => {
                          if (!v || v === member.role) return
                          handleRoleChange(member.id, v, member.user.name || member.user.email)
                        }}
                        disabled={roleLoading === member.id}
                      >
                        <SelectTrigger className="h-7 w-7 rounded-lg p-0 [&>svg]:hidden" size="sm">
                          <span className="sr-only">Change role</span>
                          {roleLoading === member.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Settings className="size-3.5" />
                          )}
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="TREASURER">Treasurer</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {isOwner && (
                      <Badge variant="outline" className="border-brand-200 text-brand-700 text-xs">
                        Protected
                      </Badge>
                    )}

                    {canManagePerms && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg text-muted-foreground"
                        onClick={() =>
                          setExpandedMember(isExpanded ? null : member.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {isExpanded && canManagePerms && !isOwner && (
                    <div className="border-t border-border/40 p-3 space-y-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">Role defaults:</span>
                        <span>{getRoleDefaults(member.role).length} permissions</span>
                        <span className="mx-1">|</span>
                        <span className="font-medium">Effective:</span>
                        <span>{effectivePerms.length} permissions</span>
                      </div>

                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            {group.label}
                          </p>
                          <div className="space-y-1">
                            {group.permissions.map(perm => {
                              const isDefault = getRoleDefaults(member.role).includes(perm)
                              const effective = effectivePerms.includes(perm)
                              const status = getPermStatus(member, perm)
                              const isLoading = permLoading === `${member.id}-${perm}`

                              return (
                                <div
                                  key={perm}
                                  className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-muted/50"
                                >
                                  <div className="flex items-center gap-2">
                                    {effective ? (
                                      <Check className="size-3.5 text-emerald-600" />
                                    ) : (
                                      <X className="size-3.5 text-destructive" />
                                    )}
                                    <span className="text-xs">
                                      {formatPermissionName(perm)}
                                    </span>
                                    {status === "granted" && (
                                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200">
                                        granted
                                      </Badge>
                                    )}
                                    {status === "denied" && (
                                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-red-100 text-red-700 border-red-200">
                                        denied
                                      </Badge>
                                    )}
                                    {status === "default" && isDefault && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                        role default
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {isLoading ? (
                                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                                    ) : status === "default" ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon-xs"
                                          className="rounded text-muted-foreground hover:text-emerald-600"
                                          onClick={() =>
                                            handleGrantPermission(
                                              member.id,
                                              perm,
                                              member.user.name || member.user.email
                                            )
                                          }
                                        >
                                          <Check className="size-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon-xs"
                                          className="rounded text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            handleDenyPermission(
                                              member.id,
                                              perm,
                                              member.user.name || member.user.email
                                            )
                                          }
                                        >
                                          <X className="size-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="rounded text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          handleRemoveOverride(
                                            member.id,
                                            perm,
                                            member.user.name || member.user.email
                                          )
                                        }
                                      >
                                        <Undo2 className="size-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {can(CIRCLE_PERMISSIONS.MEMBER_AUDIT_VIEW) && (
        <AuditHistorySection circleId={circleId} members={members} />
      )}
    </div>
  )
}
