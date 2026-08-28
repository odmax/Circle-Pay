"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Landmark,
  Plus,
  RefreshCw,
  AlertTriangle,
  FileWarning,
  Clock,
  Wallet,
  Layers,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export interface LoansPermissions {
  canApply: boolean
  canViewAll: boolean
  canReview: boolean
  canApprove: boolean
  canDisburse: boolean
  canReviewRepayments: boolean
  canManageConfig: boolean
}

interface LoansClientProps {
  circleId: string
  userId: string
  symbol: string
  permissions: LoansPermissions
}

interface LoanSummary {
  id: string
  memberId: string
  memberName: string
  principal: string
  serviceFee: string
  interestRate: string
  termMonths: number
  repaymentFrequency: string
  status: string
  purpose: string | null
  requestedAt: string | null
  approvedAt: string | null
  disbursedAt: string | null
  schedule: {
    id: string
    periodNumber: number
    dueDate: string | null
    principalDue: string
    interestDue: string
    totalDue: string
    amountPaid: string
    status: string
  }[]
  repaymentCount: number
}

interface StatusSummary {
  enabled: boolean
  totalLoans: number
  pendingReview: number
  myActiveLoans: number
  latestStatus: string | null
  myPendingReview?: number
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DISBURSED: "Disbursed",
  REPAYING: "Repaying",
  PAID_OFF: "Paid off",
  OVERDUE: "Overdue",
  DEFAULTED: "Defaulted",
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "border-sky-200 bg-sky-50 text-sky-700",
  UNDER_REVIEW: "border-sky-200 bg-sky-50 text-sky-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  DISBURSED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  REPAYING: "border-blue-200 bg-blue-50 text-blue-700",
  PAID_OFF: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-orange-200 bg-orange-50 text-orange-700",
  DEFAULTED: "border-red-200 bg-red-50 text-red-700",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
}

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—"
}

async function getJson(url: string) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Request failed")
  }
  return data
}

export function LoansClient({ circleId, userId, symbol, permissions }: LoansClientProps) {
  const [loans, setLoans] = useState<LoanSummary[]>([])
  const [status, setStatus] = useState<StatusSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "mine">(
    permissions.canViewAll ? "all" : "mine"
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loansRes, statusRes] = await Promise.all([
        getJson(`/api/circles/${circleId}/loans`),
        getJson(`/api/circles/${circleId}/loans/status`),
      ])
      setLoans(loansRes.loans ?? [])
      setStatus(statusRes.status ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load loans")
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertCircle className="size-8 text-red-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={load}>
            <RefreshCw className="size-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const canViewAll = permissions.canViewAll || permissions.canReview || permissions.canApprove || permissions.canDisburse || permissions.canReviewRepayments

  const sorted = [...loans].sort(
    (a, b) => new Date(b.requestedAt ?? 0).getTime() - new Date(a.requestedAt ?? 0).getTime()
  )
  const shown = filter === "mine" ? sorted.filter((l) => l.memberId === userId) : sorted

  const pending = sorted.filter((l) => l.status === "SUBMITTED" || l.status === "UNDER_REVIEW")
  const overdue = loans.filter((l) => l.status === "OVERDUE")
  const defaulted = loans.filter((l) => l.status === "DEFAULTED")
  const active = loans.filter((l) => ["APPROVED", "DISBURSED", "REPAYING", "OVERDUE"].includes(l.status))
  const outstanding = active.reduce((sum, l) => sum + Number(l.principal ?? 0), 0)

  const statusToShow = status ?? ({} as StatusSummary)
  const showAlerts = status && status.enabled === false && pending.length === 0

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">Overdue loans</p>
            <p className="text-xs text-red-600">
              {overdue.length} loan{overdue.length > 1 ? "s" : ""} marked overdue require attention.
            </p>
          </div>
        </div>
      )}
      {defaulted.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <FileWarning className="size-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">Defaulted loans</p>
            <p className="text-xs text-red-600">
              {defaulted.length} loan{defaulted.length > 1 ? "s" : ""} have been defaulted.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Layers className="size-4" /> {canViewAll ? "Total loans" : "My loans"}
            </div>
            <p className="text-2xl font-bold mt-1">{canViewAll ? statusToShow.totalLoans : loans.filter((l) => l.memberId === userId).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Clock className="size-4" /> Active loans
            </div>
            <p className="text-2xl font-bold mt-1">{canViewAll ? active.length : statusToShow.myActiveLoans}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Wallet className="size-4" /> Outstanding
            </div>
            <p className={`text-2xl font-bold mt-1 ${outstanding > 0 ? "text-orange-600" : "text-emerald-600"}`}>
              {symbol}{outstanding.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <AlertTriangle className="size-4" /> Pending review
            </div>
            <p className="text-2xl font-bold mt-1">{canViewAll ? statusToShow.pendingReview : statusToShow.myPendingReview ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin quick panel */}
      {canViewAll && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Application queue</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No loan applications awaiting review.</p>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                    <div>
                      <p className="font-medium">{l.memberName}</p>
                      <p className="text-xs text-muted-foreground">
                        {symbol}{Number(l.principal).toLocaleString()} · {l.termMonths} mo · {fmtDate(l.requestedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[l.status] ?? ""}`}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="xs"
                        className="rounded-lg"
                        render={<Link href={`/circles/${circleId}/loans/${l.id}`} />}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
                {pending.length > 5 && (
                  <p className="text-xs text-muted-foreground">… and {pending.length - 5} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loans table */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Loans</CardTitle>
          <div className="flex items-center gap-2">
            {canViewAll && (
              <>
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="xs"
                  className="rounded-lg"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={filter === "mine" ? "default" : "outline"}
                  size="xs"
                  className="rounded-lg"
                  onClick={() => setFilter("mine")}
                >
                  Mine only
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg"
              onClick={load}
              aria-label="Refresh"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            {permissions.canApply && (
              <Button size="xs" className="rounded-lg" render={<Link href={`/circles/${circleId}/loans/apply`} />}>
                <Plus className="size-3.5 mr-1" /> Apply
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Landmark className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filter === "mine" ? "You have no loans yet." : "No loans to display."}
              </p>
              {permissions.canApply && filter === "mine" && (
                <Button size="sm" className="rounded-xl" render={<Link href={`/circles/${circleId}/loans/apply`} />}>
                  <Plus className="size-4 mr-1" /> Apply for a loan
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    {canViewAll && <th className="py-2 pr-3 font-medium">Member</th>}
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Term</th>
                    <th className="py-2 pr-3 font-medium">Frequency</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id} className="border-b border-border/40 last:border-0">
                      {canViewAll && (
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{l.memberName}</p>
                        </td>
                      )}
                      <td className="py-2.5 pr-3 font-semibold">{symbol}{Number(l.principal).toLocaleString()}</td>
                      <td className="py-2.5 pr-3">{l.termMonths} mo</td>
                      <td className="py-2.5 pr-3">{FREQ_LABELS[l.repaymentFrequency] ?? l.repaymentFrequency}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[l.status] ?? ""}`}>
                          {STATUS_LABELS[l.status] ?? l.status}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{fmtDate(l.requestedAt)}</span>
                          <Button
                            variant="outline"
                            size="xs"
                            className="rounded-lg"
                            render={<Link href={`/circles/${circleId}/loans/${l.id}`} />}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAlerts && status.enabled === false && (
            <p className="mt-3 text-xs text-muted-foreground">
              Loans are currently <span className="font-medium text-amber-600">disabled</span> for this circle. Contact an authorized member (treasurer or admin) to enable them.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
