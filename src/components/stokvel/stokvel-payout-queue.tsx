"use client"

import { Users, ArrowRight, CheckCircle2, Clock, MinusCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StokvelPayoutQueueProps {
  payout: {
    hasSchedule: boolean
    currentBeneficiary: { name: string; amount: number; dueDate: string } | null
    nextBeneficiary: { name: string; amount: number; dueDate: string } | null
    myPosition: number | null
    totalCycles: number
    completedCycles: number
    readiness: string
    blockers: string[]
    schedule: { name: string; status: string; amount: number; order: number }[]
    previousPayout: { name: string; amount: number; completedAt: string | null } | null
  }
  symbol: string
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  COMPLETED: CheckCircle2,
  UPCOMING: Clock,
  READY: ArrowRight,
  SKIPPED: MinusCircle,
}

export function StokvelPayoutQueue({ payout, symbol }: StokvelPayoutQueueProps) {
  if (!payout.hasSchedule) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Payout Rotation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-medium">No payout schedule</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Generate a payout rotation schedule to get started
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Payout Rotation</CardTitle>
        <Badge variant="outline" className="text-[10px]">
          {payout.completedCycles}/{payout.totalCycles} completed
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {payout.currentBeneficiary && (
            <div className="rounded-xl bg-brand-50/50 p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Current</p>
              <p className="text-sm font-semibold mt-1">{payout.currentBeneficiary.name}</p>
              <p className="text-xs text-muted-foreground">
                {symbol}{payout.currentBeneficiary.amount.toLocaleString()}
              </p>
            </div>
          )}
          {payout.nextBeneficiary && (
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Next</p>
              <p className="text-sm font-semibold mt-1">{payout.nextBeneficiary.name}</p>
              <p className="text-xs text-muted-foreground">
                {symbol}{payout.nextBeneficiary.amount.toLocaleString()}
              </p>
            </div>
          )}
          {payout.myPosition !== null && (
            <div className="rounded-xl bg-emerald-50/50 p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">My Position</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">#{payout.myPosition}</p>
              <p className="text-xs text-muted-foreground">
                of {payout.totalCycles}
              </p>
            </div>
          )}
        </div>

        {payout.readiness === "BLOCKED" && payout.blockers.length > 0 && (
          <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">
            <p className="font-semibold mb-1">Payout blocked</p>
            <ul className="list-inside list-disc space-y-0.5">
              {payout.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {payout.previousPayout && (
          <div className="rounded-xl bg-muted/30 p-2.5 text-xs">
            <span className="text-muted-foreground">Previous payout: </span>
            <span className="font-medium">{payout.previousPayout.name}</span>
            <span className="text-muted-foreground"> — {symbol}{payout.previousPayout.amount.toLocaleString()}</span>
            {payout.previousPayout.completedAt && (
              <span className="text-muted-foreground">
                {" "}on {new Date(payout.previousPayout.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Schedule</h4>
          <div className="space-y-1">
            {payout.schedule.slice(0, 8).map((item) => {
              const Icon = STATUS_ICON[item.status] ?? Clock
              return (
                <div
                  key={item.order}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`size-3.5 ${item.status === "COMPLETED" ? "text-emerald-500" : item.status === "READY" ? "text-brand" : "text-muted-foreground"}`} />
                    <span className="font-medium">#{item.order}</span>
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{symbol}{item.amount.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              )
            })}
            {payout.schedule.length > 8 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{payout.schedule.length - 8} more
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
