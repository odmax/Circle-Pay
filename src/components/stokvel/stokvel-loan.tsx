"use client"

import Link from "next/link"
import { Landmark, Clock, Wallet, AlertTriangle, FileWarning, Lock, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface LoanWidgetView {
  enabled: boolean
  canApply: boolean
  myActiveLoans: number
  myPendingReview: number
  nextRepayment: {
    amount: number
    dueDate: string
    status: string
    periodNumber: number
    loanId: string
  } | null
  outstandingBalance: number
  overdue: boolean
  defaulted: boolean
  totalLoansOutstanding: number
  pendingApplications: number
  repaymentRate: number
  latestStatus: string | null
}

interface StokvelLoanProps {
  circleId: string
  loan: LoanWidgetView
  symbol: string
  canReviewLoans: boolean
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
  PENDING: "Pending",
  PROOF_SUBMITTED: "Proof submitted",
  CONFIRMED: "Confirmed",
}

function fmtSym(symbol: string, value: number) {
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function StokvelLoan({ circleId, loan, symbol, canReviewLoans }: StokvelLoanProps) {
  const dueDate = loan.nextRepayment?.dueDate
    ? new Date(loan.nextRepayment.dueDate)
    : null
  const dueLabel = dueDate
    ? dueDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "—"

  const nextStatusLabel = loan.nextRepayment
    ? STATUS_LABELS[loan.nextRepayment.status] ?? loan.nextRepayment.status
    : null

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Landmark className="size-4 text-brand" />
          Loans
        </CardTitle>
        <Button
          variant="outline"
          size="xs"
          className="rounded-lg"
          render={<Link href={`/circles/${circleId}/loans`} />}
        >
          Manage <ArrowRight className="size-3" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {!loan.enabled ? (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            Loans are not currently enabled for this circle.
          </div>
        ) : (
          <>
            {loan.defaulted && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                <FileWarning className="size-4 shrink-0" /> A loan has been defaulted.
              </div>
            )}
            {loan.overdue && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="size-4 shrink-0" /> Repayment is overdue.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Active loans</p>
                <p className="font-semibold text-lg">{loan.myActiveLoans}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Outstanding</p>
                <p className={`font-semibold text-lg ${loan.outstandingBalance > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                  {fmtSym(symbol, loan.outstandingBalance)}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3" /> Next repayment
                </p>
                {loan.nextRepayment ? (
                  <div>
                    <p className="font-semibold">{fmtSym(symbol, loan.nextRepayment.amount)}</p>
                    <p className={`text-xs ${loan.overdue ? "text-red-600" : "text-muted-foreground"}`}>
                      {dueLabel} · {nextStatusLabel}
                    </p>
                  </div>
                ) : (
                  <p className="font-semibold text-muted-foreground">No due payment</p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Wallet className="size-3" /> Latest status
                </p>
                {loan.latestStatus ? (
                  <p className="font-semibold">{STATUS_LABELS[loan.latestStatus] ?? loan.latestStatus}</p>
                ) : (
                  <p className="text-muted-foreground">No loans yet</p>
                )}
              </div>
            </div>

            {loan.canApply && loan.myActiveLoans === 0 && (
              <Button
                size="sm"
                className="rounded-xl w-full"
                render={<Link href={`/circles/${circleId}/loans/apply`} />}
              >
                <Landmark className="size-4" /> Apply for a loan
              </Button>
            )}
            {loan.myPendingReview > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
                You have {loan.myPendingReview} application{loan.myPendingReview > 1 ? "s" : ""} under review.
              </div>
            )}
          </>
        )}

        {canReviewLoans && (
          <div className="border-t border-border/60 pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Portfolio</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="font-semibold">{loan.pendingApplications}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-semibold">{fmtSym(symbol, loan.totalLoansOutstanding)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Repaid</p>
                <p className="font-semibold">{loan.repaymentRate}%</p>
              </div>
            </div>
          </div>
        )}

        {!loan.enabled && canReviewLoans && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" /> Loans disabled — enable via the loans page.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
