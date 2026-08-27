"use client"

import { PiggyBank, Clock, CheckCircle2, AlertTriangle, TrendingUp, CalendarClock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StokvelMyContributionProps {
  my: {
    monthlyContribution: number
    contributionStatus: string
    nextDueDate: string | null
    daysRemaining: number | null
    totalContributed: number
    outstandingAmount: number
    paymentStreak: number
    proofStatus: string | null
  }
  symbol: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  PAID: { label: "Paid", color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  CONFIRMED: { label: "Confirmed", color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  PENDING_REVIEW: { label: "Awaiting Review", color: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock },
  DUE: { label: "Due", color: "border-orange-200 bg-orange-50 text-orange-700", icon: AlertTriangle },
  OVERDUE: { label: "Overdue", color: "border-red-200 bg-red-50 text-red-700", icon: AlertTriangle },
  UPCOMING: { label: "Upcoming", color: "border-slate-200 bg-slate-50 text-slate-600", icon: CalendarClock },
  NONE: { label: "No contribution yet", color: "border-slate-200 bg-slate-50 text-slate-600", icon: PiggyBank },
}

const PROOF_CONFIG: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: "Verified", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  NEEDS_REVIEW: { label: "Needs Review", color: "border-amber-200 bg-amber-50 text-amber-700" },
  REJECTED: { label: "Rejected", color: "border-red-200 bg-red-50 text-red-700" },
  PENDING: { label: "Pending", color: "border-slate-200 bg-slate-50 text-slate-600" },
}

export function StokvelMyContribution({ my, symbol }: StokvelMyContributionProps) {
  const statusCfg = STATUS_CONFIG[my.contributionStatus] ?? STATUS_CONFIG.NONE
  const StatusIcon = statusCfg.icon

  return (
    <Card className="rounded-2xl border-border/40 sm:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          My Contribution
        </CardTitle>
        <PiggyBank className="size-4 text-brand" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-3xl font-bold">
              {symbol}{my.monthlyContribution.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">per month</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
            <StatusIcon className="size-3 mr-1" />
            {statusCfg.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Total contributed</p>
            <p className="font-semibold">{symbol}{my.totalContributed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Outstanding</p>
            <p className={`font-semibold ${my.outstandingAmount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {symbol}{my.outstandingAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Streak</p>
            <p className="font-semibold flex items-center gap-1">
              <TrendingUp className="size-3.5 text-emerald-500" />
              {my.paymentStreak} month{my.paymentStreak === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Next due</p>
            {my.nextDueDate ? (
              <p className={`font-semibold ${my.daysRemaining !== null && my.daysRemaining <= 3 ? "text-orange-600" : ""}`}>
                {my.daysRemaining !== null && my.daysRemaining >= 0
                  ? `${my.daysRemaining}d`
                  : my.daysRemaining !== null
                  ? `${Math.abs(my.daysRemaining)}d overdue`
                  : "—"}
              </p>
            ) : (
              <p className="font-semibold text-muted-foreground">No schedule</p>
            )}
          </div>
        </div>

        {my.proofStatus && my.proofStatus !== "VERIFIED" && (
          <div className="rounded-xl bg-muted/50 p-2.5 text-xs">
            <span className="text-muted-foreground">Proof status: </span>
            <span className="font-medium">{PROOF_CONFIG[my.proofStatus]?.label ?? my.proofStatus}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
