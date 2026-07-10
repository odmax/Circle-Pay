import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Repeat, DollarSign } from "lucide-react"
import { FrequencyBadge } from "./contribution-status-badge"

interface PlanWithStats {
  id: string
  name: string
  description: string | null
  amount: number
  frequency: string
  dueDay: number | null
  isActive: boolean
  totalContributions?: number
}

export function ContributionPlanCard({
  plan,
  currencySymbol = "$",
}: {
  plan: PlanWithStats
  currencySymbol?: string
}) {
  return (
    <Card
      className={`rounded-2xl border-border/40 transition-colors ${
        !plan.isActive ? "opacity-60" : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{plan.name}</h4>
              {!plan.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            {plan.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {plan.description}
              </p>
            )}
          </div>
          <span className="shrink-0 text-lg font-bold text-brand">
            {currencySymbol}
            {Number(plan.amount).toLocaleString()}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Repeat className="size-3" />
            <FrequencyBadge frequency={plan.frequency} />
          </span>
          {plan.dueDay && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              Day {plan.dueDay}
            </span>
          )}
          {plan.totalContributions !== undefined && (
            <span className="flex items-center gap-1">
              <DollarSign className="size-3" />
              {plan.totalContributions} contribution
              {plan.totalContributions !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
