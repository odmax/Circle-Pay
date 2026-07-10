import { Card, CardContent } from "@/components/ui/card"
import { getCircleIcon, getCircleColor } from "@/components/circles/circle-type-badge"
import { createElement } from "react"
import { GoalProgress } from "@/components/goals/goal-progress"
import { CURRENCIES } from "@/lib/constants"

interface HeroProps {
  circle: {
    id: string; name: string; type: string; currency: string
    settings: Record<string, unknown> | null; memberCount: number
  }
  stats: {
    totalContributions: number; activeGoals: number; totalGoalSaved: number
    totalGoalTarget: number; goalProgress: number; pendingBalances: number
  }
}

export function TypeSpecificHero({ circle, stats }: HeroProps) {
  const Icon = getCircleIcon(circle.type)
  const colorClass = getCircleColor(circle.type)
  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency
  const s = circle.settings || {}

  const typeHero: Record<string, React.ReactNode> = {
    STOKVEL: <HeroGrid items={[
      { label: "Pool Value", value: `${symbol}${stats.totalContributions.toLocaleString()}` },
      { label: "Frequency", value: String(s.contributionFrequency || "Monthly") },
      { label: "Members", value: circle.memberCount.toString() },
      { label: "Goals", value: stats.activeGoals.toString() },
    ]} />,
    HOUSEMATE: <HeroGrid items={[
      { label: "Rent", value: s.rentAmount ? `${symbol}${Number(s.rentAmount).toLocaleString()}` : "Not set" },
      { label: "Due Day", value: `Day ${s.rentDueDay || "—"}` },
      { label: "Pool", value: `${symbol}${stats.totalContributions.toLocaleString()}` },
      { label: "Balances", value: stats.pendingBalances.toString() },
    ]} />,
    TRAVEL: <HeroGrid items={[
      { label: "Destination", value: String(s.destination || "—") },
      { label: "Budget/person", value: s.budgetPerPerson ? `${symbol}${Number(s.budgetPerPerson).toLocaleString()}` : "—" },
      { label: "Saved", value: `${symbol}${stats.totalContributions.toLocaleString()}` },
      { label: "Goals", value: stats.activeGoals.toString() },
    ]} />,
    WEDDING: <HeroGrid items={[
      { label: "Budget", value: s.totalBudget ? `${symbol}${Number(s.totalBudget).toLocaleString()}` : "—" },
      { label: "Saved", value: `${symbol}${stats.totalGoalSaved.toLocaleString()}` },
      { label: "Progress", value: `${stats.goalProgress}%` },
      { label: "Members", value: circle.memberCount.toString() },
    ]} />,
    SAVINGS: (
      <div>
        <HeroGrid items={[
          { label: "Target", value: s.targetAmount ? `${symbol}${Number(s.targetAmount).toLocaleString()}` : "—" },
          { label: "Saved", value: `${symbol}${stats.totalGoalSaved.toLocaleString()}` },
          { label: "Progress", value: `${stats.goalProgress}%` },
          { label: "Members", value: circle.memberCount.toString() },
        ]} />
        {stats.totalGoalTarget > 0 && <GoalProgress current={stats.totalGoalSaved} target={stats.totalGoalTarget} size="lg" />}
      </div>
    ),
    FAMILY: <HeroGrid items={[
      { label: "Purpose", value: String(s.fundPurpose || "Family Fund") },
      { label: "Saved", value: `${symbol}${stats.totalContributions.toLocaleString()}` },
      { label: "Goals", value: stats.activeGoals.toString() },
      { label: "Emergency", value: s.emergencyFund ? "Enabled" : "Disabled" },
    ]} />,
    CHURCH: <HeroGrid items={[
      { label: "Project", value: String(s.projectName || "—") },
      { label: "Target", value: s.fundraisingGoal ? `${symbol}${Number(s.fundraisingGoal).toLocaleString()}` : "—" },
      { label: "Raised", value: `${symbol}${stats.totalContributions.toLocaleString()}` },
      { label: "Members", value: circle.memberCount.toString() },
    ]} />,
    INVESTMENT: <HeroGrid items={[
      { label: "Goal", value: String(s.investmentGoal || "—") },
      { label: "Monthly", value: s.monthlyContribution ? `${symbol}${Number(s.monthlyContribution).toLocaleString()}` : "—" },
      { label: "Risk", value: String(s.riskLevel || "Medium") },
      { label: "Contributions", value: `${symbol}${stats.totalContributions.toLocaleString()}` },
    ]} />,
    CUSTOM: <HeroGrid items={[
      { label: "Contributions", value: s.enableContributions !== false ? "On" : "Off" },
      { label: "Expenses", value: s.enableExpenses !== false ? "On" : "Off" },
      { label: "Goals", value: s.enableGoals !== false ? "On" : "Off" },
      { label: "Balances", value: s.enableBalances !== false ? "On" : "Off" },
    ]} />,
  }

  return (
    <Card className="rounded-2xl border-border/40 overflow-hidden">
      <div className={`${colorClass} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 text-white">
            {createElement(Icon, { className: "size-6" })}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{circle.name}</h1>
            <p className="text-sm text-white/80">{circle.type.charAt(0) + circle.type.slice(1).toLowerCase()}</p>
          </div>
        </div>
      </div>
      <CardContent className="p-4">
        {typeHero[circle.type] || <p className="text-sm text-muted-foreground">Circle overview</p>}
      </CardContent>
    </Card>
  )
}

function HeroGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <div key={i}>
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-lg font-bold mt-0.5">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
