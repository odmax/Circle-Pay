"use client"

import Link from "next/link"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { StokvelDashboardData } from "@/lib/services/stokvel-dashboard.service"

interface StokvelGroceryProps {
  circleId: string
  grocery: StokvelDashboardData["grocery"]
  symbol: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PURCHASING: "border-sky-200 bg-sky-50 text-sky-700",
  DISTRIBUTING: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CLOSED: "border-slate-300 bg-slate-100 text-slate-600",
}

export function StokvelGrocery({ circleId, grocery, symbol }: StokvelGroceryProps) {
  const active = grocery.activeCampaign

  return (
    <Card className="rounded-2xl border-border/40">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="size-4 text-brand" />
            Grocery
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="rounded-lg"
            render={<Link href={`/circles/${circleId}/grocery`} />}
          >
            View <ArrowRight className="size-3 ml-1" />
          </Button>
        </div>

        {!grocery.enabled && !grocery.hasCampaign ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Grocery buying mode is not yet set up for this circle.
          </p>
        ) : !active ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {grocery.hasCampaign ? "No active grocery campaign right now." : "Grocery buying mode is enabled — start a campaign."}
          </p>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize"
              >
                {active.status.toLowerCase()}
              </span>
            </div>
            <p className="mt-2 font-medium">{active.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {symbol}{Math.round(active.amountCollected).toLocaleString()} of{" "}
              {symbol}{active.targetAmount.toLocaleString()} collected
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(100, active.targetPercent)}%` }}
              />
            </div>
            <Button
              size="sm"
              className="mt-3 rounded-lg"
              render={<Link href={`/circles/${circleId}/grocery/${active.id}`} />}
            >
              Open campaign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
