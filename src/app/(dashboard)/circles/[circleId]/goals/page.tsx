import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Target, Trophy, PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getGoals, getGoalStats } from "@/lib/services/goal.service"
import { CreateGoalForm } from "@/components/goals/create-goal-form"
import { AllocateGoalForm } from "@/components/goals/allocate-goal-form"
import { GoalCard } from "@/components/goals/goal-card"
import { GoalProgress } from "@/components/goals/goal-progress"
import { CURRENCIES } from "@/lib/constants"

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle, goals, stats
  try {
    ;[circle, goals, stats] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getGoals(circleId, session.user.id),
      getGoalStats(circleId, session.user.id),
    ])
  } catch {
    notFound()
  }

  const currency = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = currency?.symbol ?? circle.currency

  const membersForForm = circle.members.map((m) => ({
    id: m.user.id,
    name: m.user.name || m.user.email,
  }))

  const activeGoals = goals.filter((g) => g.status === "ACTIVE")
  const completedGoals = goals.filter((g) => g.status === "COMPLETED")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            render={<Link href={`/circles/${circleId}`} />}
            variant="outline"
            size="icon"
            className="rounded-xl"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
            <p className="text-muted-foreground">{circle.name}</p>
          </div>
        </div>
        <CreateGoalForm circleId={circleId} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Goals
            </CardTitle>
            <Target className="size-4 text-brand" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeGoals}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Saved
            </CardTitle>
            <PiggyBank className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {symbol}
              {stats.totalSaved.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <Trophy className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedGoals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      {stats.totalTarget > 0 && (
        <Card className="rounded-2xl border-brand-200 bg-brand-50/30">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium text-brand-800">
              Overall Progress — {symbol}
              {stats.totalSaved.toLocaleString()} of{" "}
              {symbol}
              {stats.totalTarget.toLocaleString()}
            </p>
            <GoalProgress
              current={stats.totalSaved}
              target={stats.totalTarget}
              size="lg"
            />
          </CardContent>
        </Card>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Active Goals ({activeGoals.length})
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeGoals.map((goal) => (
              <div key={goal.id} className="space-y-3">
                <GoalCard goal={goal} currencySymbol={symbol} />
                {/* Allocate button on each active goal */}
                <div className="flex items-center justify-between px-1">
                  <AllocateGoalForm
                    circleId={circleId}
                    goalId={goal.id}
                    members={membersForForm}
                    currencySymbol={symbol}
                  />
                  <span className="text-xs text-muted-foreground">
                    {goal.allocationCount} allocation
                    {goal.allocationCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Completed Goals ({completedGoals.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completedGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} currencySymbol={symbol} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <Card className="rounded-2xl border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <Target className="size-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No goals yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a savings target and track progress together.
            </p>
            <div className="mt-4">
              <CreateGoalForm circleId={circleId} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
