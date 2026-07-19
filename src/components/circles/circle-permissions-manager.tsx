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
    </div>
  )
}
