"use client"

import { useState, useEffect } from "react"
import {
  Shield,
  AlertTriangle,
  Users,
  GitBranch,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type GovernanceMetrics = {
  pendingApprovals: number
  activeWorkflows: number
  activeDelegations: number
  overdueApprovals: number
  averageApprovalTimeHours: number | null
  approvalRate: number
}

export function GovernanceMetricsWidget({ circleId }: { circleId: string }) {
  const [metrics, setMetrics] = useState<GovernanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch(`/api/circles/${circleId}/governance-metrics`)
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
        }
      } catch {
        // Silently fail — widget just won't show
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [circleId])

  if (loading) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!metrics) return null

  const items = [
    {
      icon: Clock,
      label: "Pending Reviews",
      value: metrics.pendingApprovals,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      icon: GitBranch,
      label: "Active Workflows",
      value: metrics.activeWorkflows,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Users,
      label: "Active Delegations",
      value: metrics.activeDelegations,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: AlertTriangle,
      label: "Overdue",
      value: metrics.overdueApprovals,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      icon: TrendingUp,
      label: "Approval Rate",
      value: `${metrics.approvalRate}%`,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ]

  if (metrics.averageApprovalTimeHours != null) {
    items.push({
      icon: Clock,
      label: "Avg. Approval Time",
      value: metrics.averageApprovalTimeHours < 1
        ? `${Math.round(metrics.averageApprovalTimeHours * 60)}m`
        : `${Math.round(metrics.averageApprovalTimeHours)}h`,
      color: "text-brand-600",
      bg: "bg-brand-50",
    })
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="size-4" />
          Governance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="text-center">
                <div className={`inline-flex items-center justify-center size-8 rounded-xl ${item.bg} mb-1.5`}>
                  <Icon className={`size-4 ${item.color}`} />
                </div>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
