"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  User,
  Shield,
  Key,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type WorkflowReviewer = {
  id?: string
  reviewerType: "ROLE" | "MEMBER" | "PERMISSION"
  role: string | null
  memberId: string | null
  permission: string | null
  required: boolean
}

type WorkflowStage = {
  id?: string
  name: string
  description: string
  order: number
  mode: "SEQUENTIAL" | "PARALLEL"
  minimumApprovals: number
  rejectionThreshold: number | null
  requireAllReviewers: boolean
  allowSelfApproval: boolean
  ownerRequired: boolean
  expiresAfterHours: number | null
  escalationAfterHours: number | null
  reviewers: WorkflowReviewer[]
}

type WorkflowData = {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  priority: number
  minimumAmount: number | null
  maximumAmount: number | null
  currency: string | null
  isDefault: boolean
  version: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  stages: Array<{
    id: string
    name: string
    description: string | null
    order: number
    mode: string
    minimumApprovals: number
    rejectionThreshold: number | null
    requireAllReviewers: boolean
    allowSelfApproval: boolean
    ownerRequired: boolean
    expiresAfterHours: number | null
    escalationAfterHours: number | null
    reviewers: Array<{
      id: string
      reviewerType: string
      role: string | null
      memberId: string | null
      permission: string | null
      required: boolean
    }>
    createdAt: string
    updatedAt: string
  }>
  createdBy: { id: string; name: string | null; email: string; image: string | null } | null
}

const APPROVAL_TYPES = [
  { value: "CONTRIBUTION", label: "Contribution" },
  { value: "EXPENSE", label: "Expense" },
  { value: "SETTLEMENT", label: "Settlement" },
  { value: "PROJECT", label: "Project" },
  { value: "WALLET_WITHDRAWAL", label: "Wallet Withdrawal" },
  { value: "WALLET_TRANSFER", label: "Wallet Transfer" },
  { value: "GOAL_WITHDRAWAL", label: "Goal Withdrawal" },
  { value: "JOIN_REQUEST", label: "Join Request" },
  { value: "MEMBER_PROMOTION", label: "Member Promotion" },
  { value: "OTHER", label: "Other" },
]

const ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
]

const PERMISSIONS = [
  "CONTRIBUTION_REVIEW",
  "EXPENSE_APPROVE",
  "SETTLEMENT_CONFIRM",
  "PROJECT_APPROVE",
  "PAYOUT_APPROVE",
  "MEMBER_ROLE_UPDATE",
  "GOAL_UPDATE",
  "JOIN_REQUEST_REVIEW",
]

function createEmptyStage(order: number): WorkflowStage {
  return {
    name: `Stage ${order}`,
    description: "",
    order,
    mode: "SEQUENTIAL",
    minimumApprovals: 1,
    rejectionThreshold: null,
    requireAllReviewers: false,
    allowSelfApproval: false,
    ownerRequired: false,
    expiresAfterHours: null,
    escalationAfterHours: null,
    reviewers: [],
  }
}

export function WorkflowEditor({
  circleId,
  initialWorkflow,
  members,
  actorUserId,
}: {
  circleId: string
  initialWorkflow: WorkflowData | null
  members: Array<{
    userId: string
    name: string | null
    email: string
    image: string | null
    role: string
  }>
  actorUserId: string
}) {
  const router = useRouter()
  const isEditing = !!initialWorkflow

  const [name, setName] = useState(initialWorkflow?.name ?? "")
  const [description, setDescription] = useState(initialWorkflow?.description ?? "")
  const [type, setType] = useState(initialWorkflow?.type ?? "CONTRIBUTION")
  const [priority, setPriority] = useState(initialWorkflow?.priority ?? 0)
  const [minimumAmount, setMinimumAmount] = useState(initialWorkflow?.minimumAmount?.toString() ?? "")
  const [maximumAmount, setMaximumAmount] = useState(initialWorkflow?.maximumAmount?.toString() ?? "")
  const [currency, setCurrency] = useState(initialWorkflow?.currency ?? "")
  const [isDefault, setIsDefault] = useState(initialWorkflow?.isDefault ?? false)
  const [stages, setStages] = useState<WorkflowStage[]>(
    initialWorkflow?.stages.map((s) => ({
      name: s.name,
      description: s.description ?? "",
      order: s.order,
      mode: s.mode as "SEQUENTIAL" | "PARALLEL",
      minimumApprovals: s.minimumApprovals,
      rejectionThreshold: s.rejectionThreshold,
      requireAllReviewers: s.requireAllReviewers,
      allowSelfApproval: s.allowSelfApproval,
      ownerRequired: s.ownerRequired,
      expiresAfterHours: s.expiresAfterHours,
      escalationAfterHours: s.escalationAfterHours,
      reviewers: s.reviewers.map((r) => ({
        reviewerType: r.reviewerType as "ROLE" | "MEMBER" | "PERMISSION",
        role: r.role,
        memberId: r.memberId,
        permission: r.permission,
        required: r.required,
      })),
    })) ?? [createEmptyStage(1)]
  )
  const [expandedStage, setExpandedStage] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  function addStage() {
    const newOrder = stages.length + 1
    setStages((prev) => [...prev, createEmptyStage(newOrder)])
    setExpandedStage(stages.length)
  }

  function removeStage(index: number) {
    if (stages.length <= 1) {
      toast.error("Workflow must have at least one stage")
      return
    }
    setStages((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i + 1 }))
    )
    setExpandedStage(Math.min(expandedStage, stages.length - 2))
  }

  function updateStage(index: number, updates: Partial<WorkflowStage>) {
    setStages((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    )
  }

  function addReviewer(stageIndex: number) {
    updateStage(stageIndex, {
      reviewers: [
        ...stages[stageIndex].reviewers,
        { reviewerType: "MEMBER", role: null, memberId: null, permission: null, required: false },
      ],
    })
  }

  function updateReviewer(stageIndex: number, reviewerIndex: number, updates: Partial<WorkflowReviewer>) {
    const stage = stages[stageIndex]
    const newReviewers = stage.reviewers.map((r, i) =>
      i === reviewerIndex ? { ...r, ...updates } : r
    )
    updateStage(stageIndex, { reviewers: newReviewers })
  }

  function removeReviewer(stageIndex: number, reviewerIndex: number) {
    updateStage(stageIndex, {
      reviewers: stages[stageIndex].reviewers.filter((_, i) => i !== reviewerIndex),
    })
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Workflow name is required")
      return
    }
    if (stages.length === 0) {
      toast.error("At least one stage is required")
      return
    }
    for (const stage of stages) {
      if (!stage.name.trim()) {
        toast.error("All stages must have a name")
        return
      }
      if (stage.reviewers.length === 0) {
        toast.error(`Stage "${stage.name}" must have at least one reviewer`)
        return
      }
    }

    setSaving(true)
    try {
      const url = isEditing
        ? `/api/circles/${circleId}/workflows/${initialWorkflow.id}`
        : `/api/circles/${circleId}/workflows`
      const method = isEditing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          type,
          priority,
          minimumAmount: minimumAmount ? parseFloat(minimumAmount) : null,
          maximumAmount: maximumAmount ? parseFloat(maximumAmount) : null,
          currency: currency || null,
          isDefault,
          stages: stages.map((s, i) => ({
            ...s,
            order: i + 1,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to save workflow")
        return
      }

      toast.success(isEditing ? "Workflow updated" : "Workflow created")
      router.push(`/circles/${circleId}/manage/approvals/workflows`)
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-sm">Workflow Configuration</CardTitle>
          <CardDescription className="text-xs">
            Define the basic properties of this approval workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Expense Approval"
                className="h-8 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Approval Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "CONTRIBUTION")}>
                <SelectTrigger className="h-8 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="min-h-[60px] rounded-xl text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                className="h-8 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Min Amount</Label>
              <Input
                type="number"
                value={minimumAmount}
                onChange={(e) => setMinimumAmount(e.target.value)}
                placeholder="No min"
                className="h-8 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Amount</Label>
              <Input
                type="number"
                value={maximumAmount}
                onChange={(e) => setMaximumAmount(e.target.value)}
                placeholder="No max"
                className="h-8 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                className="h-8 rounded-lg text-sm"
                maxLength={3}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
            <Label htmlFor="isDefault" className="text-sm cursor-pointer">
              Set as default workflow for this type
            </Label>
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Stages ({stages.length})</h2>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={addStage}>
            <Plus className="size-3 mr-1" /> Add Stage
          </Button>
        </div>

        {stages.map((stage, stageIndex) => (
          <Card key={stageIndex} className="rounded-2xl border-border/40">
            <button
              type="button"
              className="w-full"
              onClick={() => setExpandedStage(expandedStage === stageIndex ? -1 : stageIndex)}
            >
              <CardHeader className="py-3">
                <div className="flex items-center gap-3">
                  {expandedStage === stageIndex ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <div className="flex items-center gap-2 flex-1">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {stage.order}
                    </Badge>
                    <span className="text-sm font-medium">{stage.name || `Stage ${stage.order}`}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {stage.mode}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {stage.reviewers.length} reviewer{stage.reviewers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {stages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-lg text-red-500 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); removeStage(stageIndex) }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
            </button>

            {expandedStage === stageIndex && (
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Stage Name *</Label>
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStage(stageIndex, { name: e.target.value })}
                      placeholder="e.g., Manager Review"
                      className="h-8 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mode</Label>
                    <Select
                      value={stage.mode}
                      onValueChange={(v) => updateStage(stageIndex, { mode: v as "SEQUENTIAL" | "PARALLEL" })}
                    >
                      <SelectTrigger className="h-8 rounded-lg text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEQUENTIAL">Sequential</SelectItem>
                        <SelectItem value="PARALLEL">Parallel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min Approvals</Label>
                    <Input
                      type="number"
                      min={1}
                      value={stage.minimumApprovals}
                      onChange={(e) => updateStage(stageIndex, { minimumApprovals: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-8 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rejection Threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Auto"
                      value={stage.rejectionThreshold ?? ""}
                      onChange={(e) => updateStage(stageIndex, { rejectionThreshold: e.target.value ? parseInt(e.target.value) : null })}
                      className="h-8 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Expires (hrs)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Never"
                      value={stage.expiresAfterHours ?? ""}
                      onChange={(e) => updateStage(stageIndex, { expiresAfterHours: e.target.value ? parseInt(e.target.value) : null })}
                      className="h-8 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Escalate After (hrs)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Never"
                      value={stage.escalationAfterHours ?? ""}
                      onChange={(e) => updateStage(stageIndex, { escalationAfterHours: e.target.value ? parseInt(e.target.value) : null })}
                      className="h-8 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={stage.requireAllReviewers}
                      onCheckedChange={(checked) => updateStage(stageIndex, { requireAllReviewers: checked })}
                    />
                    <Label className="text-xs cursor-pointer">Require all reviewers</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={stage.allowSelfApproval}
                      onCheckedChange={(checked) => updateStage(stageIndex, { allowSelfApproval: checked })}
                    />
                    <Label className="text-xs cursor-pointer">Allow self-approval</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={stage.ownerRequired}
                      onCheckedChange={(checked) => updateStage(stageIndex, { ownerRequired: checked })}
                    />
                    <Label className="text-xs cursor-pointer">Owner required</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Reviewers ({stage.reviewers.length})</Label>
                    <Button variant="outline" size="xs" className="rounded-lg" onClick={() => addReviewer(stageIndex)}>
                      <Plus className="size-2.5 mr-0.5" /> Add
                    </Button>
                  </div>

                  {stage.reviewers.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No reviewers added</p>
                  )}

                  {stage.reviewers.map((reviewer, ri) => (
                    <div key={ri} className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
                      <GripVertical className="size-3 text-muted-foreground/50 shrink-0" />
                      <Select
                        value={reviewer.reviewerType}
                        onValueChange={(v) => updateReviewer(stageIndex, ri, { reviewerType: v as "ROLE" | "MEMBER" | "PERMISSION" })}
                      >
                        <SelectTrigger size="sm" className="w-24 h-7 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ROLE">
                            <div className="flex items-center gap-1"><Shield className="size-2.5" /> Role</div>
                          </SelectItem>
                          <SelectItem value="MEMBER">
                            <div className="flex items-center gap-1"><User className="size-2.5" /> Member</div>
                          </SelectItem>
                          <SelectItem value="PERMISSION">
                            <div className="flex items-center gap-1"><Key className="size-2.5" /> Permission</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {reviewer.reviewerType === "ROLE" && (
                        <Select
                          value={reviewer.role ?? ""}
                          onValueChange={(v) => updateReviewer(stageIndex, ri, { role: v || null })}
                        >
                          <SelectTrigger size="sm" className="flex-1 h-7 rounded-lg text-xs">
                            <SelectValue placeholder="Select role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {reviewer.reviewerType === "MEMBER" && (
                        <Select
                          value={reviewer.memberId ?? ""}
                          onValueChange={(v) => updateReviewer(stageIndex, ri, { memberId: v || null })}
                        >
                          <SelectTrigger size="sm" className="flex-1 h-7 rounded-lg text-xs">
                            <SelectValue placeholder="Select member..." />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.userId} value={m.userId}>
                                <div className="flex items-center gap-2">
                                  <Avatar size="sm">
                                    <AvatarImage src={m.image || ""} />
                                    <AvatarFallback className="text-[8px]">
                                      {m.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{m.name || m.email}</span>
                                  <Badge variant="secondary" className="text-[8px]">{m.role}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {reviewer.reviewerType === "PERMISSION" && (
                        <Select
                          value={reviewer.permission ?? ""}
                          onValueChange={(v) => updateReviewer(stageIndex, ri, { permission: v || null })}
                        >
                          <SelectTrigger size="sm" className="flex-1 h-7 rounded-lg text-xs">
                            <SelectValue placeholder="Select permission..." />
                          </SelectTrigger>
                          <SelectContent>
                            {PERMISSIONS.map((p) => (
                              <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={reviewer.required}
                          onCheckedChange={(checked) => updateReviewer(stageIndex, ri, { required: checked })}
                        />
                        <Label className="text-[10px] text-muted-foreground cursor-pointer">Req</Label>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg shrink-0 text-red-500 hover:text-red-600"
                        onClick={() => removeReviewer(stageIndex, ri)}
                      >
                        <Trash2 className="size-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
          {saving ? (
            <Loader2 className="size-3 animate-spin mr-1" />
          ) : (
            <Save className="size-3 mr-1" />
          )}
          {isEditing ? "Update Workflow" : "Create Workflow"}
        </Button>
      </div>
    </div>
  )
}
