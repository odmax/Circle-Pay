"use client"

import { useState } from "react"
import Link from "next/link"
import {
  GitBranch,
  Plus,
  MoreVertical,
  Play,
  Pause,
  Archive,
  Trash2,
  Edit,
  Layers,
  Loader2,
} from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type WorkflowStage = {
  id: string
  name: string
  order: number
  mode: string
  minimumApprovals: number
}

type Workflow = {
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
  stages: WorkflowStage[]
  createdBy: { id: string; name: string | null; email: string; image: string | null } | null
  _count: { stages: number }
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-50 text-gray-600 border-gray-200" },
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  INACTIVE: { label: "Inactive", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ARCHIVED: { label: "Archived", className: "bg-red-50 text-red-500 border-red-200" },
}

const TYPE_LABELS: Record<string, string> = {
  CONTRIBUTION: "Contribution",
  EXPENSE: "Expense",
  SETTLEMENT: "Settlement",
  PROJECT: "Project",
  WALLET_WITHDRAWAL: "Wallet Withdrawal",
  WALLET_TRANSFER: "Wallet Transfer",
  GOAL_WITHDRAWAL: "Goal Withdrawal",
  JOIN_REQUEST: "Join Request",
  MEMBER_PROMOTION: "Member Promotion",
  OTHER: "Other",
}

export function WorkflowListManager({
  circleId,
  initialWorkflows,
  actorUserId,
}: {
  circleId: string
  initialWorkflows: Workflow[]
  actorUserId: string
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows)
  const [loading, setLoading] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  async function handleStatusChange(workflowId: string, newStatus: string) {
    setLoading(workflowId)
    try {
      const res = await fetch(`/api/circles/${circleId}/workflows/${workflowId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to update status")
        return
      }
      toast.success(`Workflow ${newStatus.toLowerCase()}`)
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, status: newStatus } : w))
      )
      setMenuOpen(null)
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(workflowId: string) {
    if (!confirm("Delete this workflow?")) return
    setLoading(workflowId)
    try {
      const res = await fetch(`/api/circles/${circleId}/workflows/${workflowId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to delete")
        return
      }
      toast.success("Workflow deleted")
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId))
      setMenuOpen(null)
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(null)
    }
  }

  if (workflows.length === 0) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="py-12 text-center">
          <GitBranch className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No workflows configured</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create a workflow to define multi-stage approval processes</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {workflows.map((workflow) => {
        const statusCfg = STATUS_CONFIG[workflow.status] ?? STATUS_CONFIG.DRAFT
        const isLoading = loading === workflow.id
        const isMenuOpen = menuOpen === workflow.id

        return (
          <div
            key={workflow.id}
            className="rounded-2xl border border-border/40 bg-card p-4 relative"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand/10">
                <GitBranch className="size-4 text-brand" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/circles/${circleId}/manage/approvals/workflows/${workflow.id}`}
                        className="text-sm font-medium truncate hover:underline"
                      >
                        {workflow.name}
                      </Link>
                      {workflow.isDefault && (
                        <Badge variant="secondary" className="text-[10px] bg-brand/10 text-brand">
                          Default
                        </Badge>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{workflow.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`border text-[10px] font-medium ${statusCfg.className}`}>
                      {statusCfg.label}
                    </Badge>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg"
                        onClick={() => setMenuOpen(isMenuOpen ? null : workflow.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <MoreVertical className="size-3" />
                        )}
                      </Button>
                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border/40 bg-card shadow-lg py-1">
                          <Link
                            href={`/circles/${circleId}/manage/approvals/workflows/${workflow.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50"
                            onClick={() => setMenuOpen(null)}
                          >
                            <Edit className="size-3" /> Edit
                          </Link>
                          {workflow.status === "DRAFT" && (
                            <button
                              type="button"
                              className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 w-full text-left text-emerald-600"
                              onClick={() => handleStatusChange(workflow.id, "ACTIVE")}
                            >
                              <Play className="size-3" /> Activate
                            </button>
                          )}
                          {workflow.status === "ACTIVE" && (
                            <button
                              type="button"
                              className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 w-full text-left text-amber-600"
                              onClick={() => handleStatusChange(workflow.id, "INACTIVE")}
                            >
                              <Pause className="size-3" /> Deactivate
                            </button>
                          )}
                          {workflow.status !== "ARCHIVED" && (
                            <button
                              type="button"
                              className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 w-full text-left"
                              onClick={() => handleStatusChange(workflow.id, "ARCHIVED")}
                            >
                              <Archive className="size-3" /> Archive
                            </button>
                          )}
                          {workflow.status !== "ARCHIVED" && (
                            <button
                              type="button"
                              className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 w-full text-left text-red-600"
                              onClick={() => handleDelete(workflow.id)}
                            >
                              <Trash2 className="size-3" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    {TYPE_LABELS[workflow.type] ?? workflow.type}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="size-3" />
                    {workflow._count.stages} stage{workflow._count.stages !== 1 ? "s" : ""}
                  </div>
                  {workflow.minimumAmount != null && (
                    <span className="text-xs text-muted-foreground">
                      Min: {workflow.currency ?? ""} {Number(workflow.minimumAmount).toLocaleString()}
                    </span>
                  )}
                  {workflow.maximumAmount != null && (
                    <span className="text-xs text-muted-foreground">
                      Max: {workflow.currency ?? ""} {Number(workflow.maximumAmount).toLocaleString()}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    v{workflow.version}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
