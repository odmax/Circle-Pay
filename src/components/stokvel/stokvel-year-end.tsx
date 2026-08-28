"use client"

import Link from "next/link"
import { CalendarCheck, FileText, CheckCircle2, AlertTriangle, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface YearEndCardProps {
  circleId: string
  yearEnd: {
    hasClose: boolean
    status: string | null
    statusIndex: number
    totalSteps: number
    periodEnd: string | null
    finalizedAt: string | null
    statementsGenerated: number
    myStatement: {
      statementNumber: string
      periodStart: string
      periodEnd: string
      totalContributed: string
      finalEntitlement: string
    } | null
    blockerCodes: string[]
    clear: boolean
  }
}

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  RECONCILING: "Reconciling",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  FINALIZED: "Finalized",
  REOPENED: "Reopened (corrections)",
}

export function StokvelYearEnd({ circleId, yearEnd }: YearEndCardProps) {
  const label = yearEnd.status ? LABELS[yearEnd.status] ?? yearEnd.status : "Not started"
  const blocked = yearEnd.hasClose && !yearEnd.clear

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="size-4 text-muted-foreground" /> Year-End Close
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!yearEnd.hasClose ? (
          <p className="text-sm text-muted-foreground">No year-end close has been initiated yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium capitalize">{label}</span>
              {yearEnd.status === "FINALIZED" ? (
                <Lock className="size-4 text-emerald-500" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Step {Math.max(0, yearEnd.statusIndex + 1)} of {yearEnd.totalSteps}
                </span>
              )}
            </div>

            <div className="flex gap-1">
              {Array.from({ length: yearEnd.totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= yearEnd.statusIndex ? "bg-emerald-500" : "bg-border"
                  }`}
                />
              ))}
            </div>

            {blocked && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{yearEnd.blockerCodes.length} blocker(s) remain before closing.</span>
              </div>
            )}

            {yearEnd.finalizedAt && (
              <p className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="size-4" /> Period locked {new Date(yearEnd.finalizedAt).toLocaleDateString()}
              </p>
            )}

            {yearEnd.myStatement && (
              <div className="rounded-xl border border-border/60 p-3 space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 text-muted-foreground" /> {yearEnd.myStatement.statementNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  Net entitlement: {yearEnd.myStatement.finalEntitlement}
                </p>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" render={<Link href={`/circles/${circleId}/year-end`} />}>
              View year-end
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
