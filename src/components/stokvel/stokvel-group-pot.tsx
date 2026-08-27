"use client"

import { Wallet, Users, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StokvelGroupPotProps {
  group: {
    expectedPool: number
    collected: number
    membersPaid: number
    membersOutstanding: number
    collectionRate: number
    goalProgress: { name: string; target: number; current: number; progress: number } | null
  }
  symbol: string
}

export function StokvelGroupPot({ group, symbol }: StokvelGroupPotProps) {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Group Pot
        </CardTitle>
        <Wallet className="size-4 text-emerald-500" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-3xl font-bold text-emerald-600">
            {symbol}{group.collected.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            of {symbol}{group.expectedPool.toLocaleString()} expected
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Collection rate</span>
            <span className={`font-semibold ${group.collectionRate >= 80 ? "text-emerald-600" : group.collectionRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {group.collectionRate}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${group.collectionRate >= 80 ? "bg-emerald-500" : group.collectionRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, group.collectionRate)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="size-3.5" />
            Members paid
          </span>
          <span className="font-medium">{group.membersPaid}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="size-3.5 text-red-400" />
            Outstanding
          </span>
          <span className={`font-medium ${group.membersOutstanding > 0 ? "text-red-600" : ""}`}>
            {group.membersOutstanding}
          </span>
        </div>

        {group.goalProgress && (
          <div className="rounded-xl bg-muted/50 p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Target className="size-3.5" />
                {group.goalProgress.name}
              </span>
              <span className="font-medium">{group.goalProgress.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${Math.min(100, group.goalProgress.progress)}%` }}
              />
            </div>
            <p className="text-muted-foreground">
              {symbol}{group.goalProgress.current.toLocaleString()} / {symbol}{group.goalProgress.target.toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
