import { Card, CardContent } from "@/components/ui/card"
import { Target, Calendar } from "lucide-react"
import { GoalProgress } from "./goal-progress"
import { GoalStatusBadge } from "./goal-status-badge"

interface GoalCardData {
  id: string
  name: string
  description: string | null
  targetAmount: number
  currentAmount: number
  deadline: Date | null
  status: string
  progress: number
}

export function GoalCard({
  goal,
  currencySymbol,
}: {
  goal: GoalCardData
  currencySymbol: string
}) {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

  return (
    <Card
      className={`rounded-2xl border-border/40 transition-colors ${
        goal.status === "COMPLETED"
          ? "border-emerald-200 bg-emerald-50/30"
          : goal.status === "CANCELLED" || goal.status === "ARCHIVED"
            ? "opacity-60"
            : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{goal.name}</h4>
              <GoalStatusBadge status={goal.status} />
            </div>
            {goal.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {goal.description}
              </p>
            )}
          </div>
          {goal.status === "COMPLETED" && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Target className="size-4" />
            </div>
          )}
        </div>

        <div className="mb-3">
          <GoalProgress current={goal.currentAmount} target={goal.targetAmount} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">
            {currencySymbol}
            {goal.currentAmount.toLocaleString()}
            <span className="text-muted-foreground font-normal">
              {" "}
              of {currencySymbol}
              {goal.targetAmount.toLocaleString()}
            </span>
          </span>
          {goal.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(goal.deadline).toLocaleDateString()}
            </span>
          )}
          {goal.status === "ACTIVE" && remaining > 0 && (
            <span className="text-amber-600 font-medium">
              {currencySymbol}
              {remaining.toLocaleString()} left
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
