import { Card, CardContent } from "@/components/ui/card"
import { GoalProgress } from "@/components/goals/goal-progress"
import { PiggyBank, Target, DollarSign, Wallet, Clock, Calendar, Building2, BarChart3, TrendingUp } from "lucide-react"
import { CURRENCIES } from "@/lib/constants"
import type { CircleWidgetType } from "@/generated/prisma"

function computeDays(targetDate: string | undefined): number | null {
  if (!targetDate) return null
  return Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

interface WidgetProps {
  widget: { id: string; type: CircleWidgetType | string; title: string; description: string | null }
  circle: { id: string; currency: string; type: string; settings: Record<string, unknown> | null }
  stats: { totalContributions: number; activeGoals: number; totalGoalSaved: number; totalGoalTarget: number; goalProgress: number; pendingBalances: number }
}

export function CircleWidgetRenderer({ widget, circle, stats }: WidgetProps) {
  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency
  const s = circle.settings || {}

  switch (widget.type) {
    case "CONTRIBUTION_SUMMARY":
      return <WidgetCard icon={<PiggyBank className="size-5" />} title={widget.title} color="bg-emerald-50 text-emerald-600">
        <p className="text-2xl font-bold">{symbol}{stats.totalContributions.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">Total contributions collected</p>
      </WidgetCard>

    case "GOAL_PROGRESS":
      return <WidgetCard icon={<Target className="size-5" />} title={widget.title} color="bg-brand-50 text-brand">
        {stats.totalGoalTarget > 0 ? (
          <div><GoalProgress current={stats.totalGoalSaved} target={stats.totalGoalTarget} size="md" /></div>
        ) : <p className="text-sm text-muted-foreground">No goals yet</p>}
      </WidgetCard>

    case "EXPENSE_SUMMARY":
      return <WidgetCard icon={<DollarSign className="size-5" />} title={widget.title} color="bg-amber-50 text-amber-600">
        <p className="text-sm text-muted-foreground">View expense history</p>
      </WidgetCard>

    case "BALANCE_SUMMARY":
      return <WidgetCard icon={<Wallet className="size-5" />} title={widget.title} color="bg-blue-50 text-blue-600">
        <p className="text-2xl font-bold">{stats.pendingBalances}</p>
        <p className="text-xs text-muted-foreground">Outstanding balances</p>
      </WidgetCard>

    case "PAYOUT_TRACKER":
      return <WidgetCard icon={<Clock className="size-5" />} title={widget.title} color="bg-violet-50 text-violet-600">
        <p className="text-sm text-muted-foreground">Payout tracking coming next</p>
        {widget.description && <p className="text-xs text-muted-foreground mt-1">{widget.description}</p>}
      </WidgetCard>

    case "COUNTDOWN": {
      const targetDate = (s.travelStart || s.weddingDate || s.goalDeadline) as string | undefined
      const days = computeDays(targetDate)
      return <CountdownWidget widget={widget} days={days} />
    }

    case "RENT_DUE":
      const rent = s.rentAmount as string
      const dueDay = s.rentDueDay as string
      return <WidgetCard icon={<Building2 className="size-5" />} title={widget.title} color="bg-orange-50 text-orange-600">
        {rent ? <p className="text-2xl font-bold">{symbol}{Number(rent).toLocaleString()}</p> : <p className="text-sm text-muted-foreground">Not configured</p>}
        {dueDay && <p className="text-xs text-muted-foreground">Due every month on day {dueDay}</p>}
      </WidgetCard>

    case "BUDGET_TRACKER":
      return <WidgetCard icon={<BarChart3 className="size-5" />} title={widget.title} color="bg-cyan-50 text-cyan-600">
        {stats.totalGoalTarget > 0 ? (
          <div><GoalProgress current={stats.totalGoalSaved} target={stats.totalGoalTarget} size="md" /></div>
        ) : <p className="text-sm text-muted-foreground">No budget set</p>}
      </WidgetCard>

    case "SAVINGS_FORECAST":
      const saving = Number(s.savingAmount) || 0
      const target = Number(s.targetAmount) || 0
      const months = saving > 0 && target > 0 ? Math.ceil(target / saving) : null
      return <WidgetCard icon={<TrendingUp className="size-5" />} title={widget.title} color="bg-emerald-50 text-emerald-600">
        {months ? (
          <div>
            <p className="text-2xl font-bold">{months} months</p>
            <p className="text-xs text-muted-foreground">At {symbol}{saving.toLocaleString()}/mo to reach {symbol}{target.toLocaleString()}</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">Configure saving amount and target</p>}
      </WidgetCard>

    case "PORTFOLIO_PLACEHOLDER":
      return <WidgetCard icon={<TrendingUp className="size-5" />} title={widget.title} color="bg-purple-50 text-purple-600">
        <p className="text-sm text-muted-foreground">Investment tracking coming soon</p>
        {s.investmentGoal ? <p className="text-xs font-medium mt-1">Goal: {s.investmentGoal as string}</p> : null}
      </WidgetCard>

    case "PROJECT_PROGRESS":
      return <WidgetCard icon={<Target className="size-5" />} title={widget.title} color="bg-indigo-50 text-indigo-600">
        {stats.totalGoalTarget > 0 ? (
          <div><GoalProgress current={stats.totalGoalSaved} target={stats.totalGoalTarget} size="md" /></div>
        ) : <p className="text-sm text-muted-foreground">No project goal yet</p>}
      </WidgetCard>

    default:
      return <Card className="rounded-2xl border-border/40">
        <CardContent className="p-4"><p className="text-sm text-muted-foreground">{widget.title}</p></CardContent>
      </Card>
  }
}

function WidgetCard({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-lg ${color}`}>{icon}</div>
          <h4 className="font-semibold text-sm">{title}</h4>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function CountdownWidget({ widget, days }: { widget: { title: string; description: string | null }; days: number | null }) {
  return (
    <WidgetCard icon={<Calendar className="size-5" />} title={widget.title} color="bg-rose-50 text-rose-600">
      {days !== null ? <p className="text-2xl font-bold">{days} days</p> : <p className="text-sm text-muted-foreground">No date set</p>}
      {widget.description && <p className="text-xs text-muted-foreground mt-1">{widget.description}</p>}
    </WidgetCard>
  )
}
