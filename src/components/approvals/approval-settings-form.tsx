"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type ApprovalSettings = {
  enabled: boolean
  minimumApprovals: number
  allowedRoles: string[]
  ownerRequiredAboveAmount: number | null
  expiryDays: number | null
}

type CircleApprovalConfig = {
  contribution?: ApprovalSettings
  expense?: ApprovalSettings
  project?: ApprovalSettings
  walletWithdrawal?: ApprovalSettings
  settlement?: ApprovalSettings
}

const ALL_ROLES = ["OWNER", "ADMIN", "TREASURER", "MEMBER"]

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  TREASURER: "Treasurer",
  MEMBER: "Member",
}

const TYPE_SECTIONS: {
  key: keyof CircleApprovalConfig
  label: string
  description: string
  available: boolean
}[] = [
  {
    key: "contribution",
    label: "Contribution Approvals",
    description: "Require approvals before contributions are confirmed",
    available: true,
  },
  {
    key: "expense",
    label: "Expense Approvals",
    description: "Require approvals before expenses are paid",
    available: true,
  },
  {
    key: "walletWithdrawal",
    label: "Wallet Withdrawal Approvals",
    description: "Require approvals for wallet withdrawals",
    available: true,
  },
  {
    key: "settlement",
    label: "Settlement Approvals",
    description: "Require approvals before settlements are confirmed",
    available: true,
  },
  {
    key: "project",
    label: "Project Approvals",
    description: "Require approvals for project creation",
    available: true,
  },
]

export function ApprovalSettingsForm({
  circleId,
  initialConfig,
}: {
  circleId: string
  initialConfig: CircleApprovalConfig
}) {
  const router = useRouter()
  const [config, setConfig] = useState<CircleApprovalConfig>(initialConfig)
  const [expandedSection, setExpandedSection] = useState<string | null>("contribution")
  const [saving, setSaving] = useState(false)

  function updateSetting(
    key: keyof CircleApprovalConfig,
    field: keyof ApprovalSettings,
    value: unknown
  ) {
    setConfig((prev) => {
      const current = prev[key] ?? {
        enabled: false,
        minimumApprovals: 1,
        allowedRoles: ["OWNER", "ADMIN"],
        ownerRequiredAboveAmount: null,
        expiryDays: 7,
      }
      return {
        ...prev,
        [key]: { ...current, [field]: value },
      }
    })
  }

  function toggleRole(key: keyof CircleApprovalConfig, role: string) {
    const current = config[key]
    if (!current) return
    const roles = current.allowedRoles.includes(role)
      ? current.allowedRoles.filter((r) => r !== role)
      : [...current.allowedRoles, role]
    updateSetting(key, "allowedRoles", roles)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/approval-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalConfig: config }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to save settings")
        return
      }
      toast.success("Approval settings saved")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {TYPE_SECTIONS.map((section) => {
        const settings = config[section.key]
        const isExpanded = expandedSection === section.key
        const isEnabled = settings?.enabled ?? false

        return (
          <Card key={section.key} className="rounded-2xl border-border/40">
            <button
              type="button"
              className="w-full"
              onClick={() =>
                setExpandedSection(isExpanded ? null : section.key)
              }
            >
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {section.label}
                        {isEnabled && (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Enabled
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {section.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </button>

            {isExpanded && section.available && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                  <Label htmlFor={`enabled-${section.key}`} className="text-sm cursor-pointer">
                    Enable approvals
                  </Label>
                  <Switch
                    id={`enabled-${section.key}`}
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      updateSetting(section.key, "enabled", checked)
                    }
                  />
                </div>

                {isEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minimum approvals required</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={settings?.minimumApprovals ?? 1}
                        onChange={(e) =>
                          updateSetting(
                            section.key,
                            "minimumApprovals",
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-24 h-8 rounded-lg text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Allowed reviewer roles</Label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map((role) => {
                          const isSelected = settings?.allowedRoles.includes(role) ?? false
                          return (
                            <button
                              key={role}
                              type="button"
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                isSelected
                                  ? "border-brand bg-brand/10 text-brand"
                                  : "border-border/40 text-muted-foreground hover:bg-muted/50"
                              }`}
                              onClick={() => toggleRole(section.key, role)}
                            >
                              {ROLE_LABELS[role] ?? role}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Owner required above amount (optional)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={settings?.ownerRequiredAboveAmount ?? ""}
                        onChange={(e) =>
                          updateSetting(
                            section.key,
                            "ownerRequiredAboveAmount",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-40 h-8 rounded-lg text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Expiry days (optional)
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        placeholder="No expiry"
                        value={settings?.expiryDays ?? ""}
                        onChange={(e) =>
                          updateSetting(
                            section.key,
                            "expiryDays",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="w-40 h-8 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            )}

            {isExpanded && !section.available && (
              <CardContent>
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Coming soon
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl"
        >
          {saving ? (
            <Loader2 className="size-3 animate-spin mr-1" />
          ) : (
            <Save className="size-3 mr-1" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
