import Link from "next/link"
import { CheckCircle2, Circle, Users, PiggyBank, Target, Receipt, FolderKanban, Repeat, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface OnboardingData {
  hasMembers: boolean
  hasPlan: boolean
  hasContribution: boolean
  hasGoal: boolean
  hasExpense: boolean
  hasProject: boolean
  hasEvent: boolean
  stepsCompleted: number
  totalSteps: number
}

export function CircleOnboardingChecklist({
  circleId,
  onboarding,
}: {
  circleId: string
  onboarding: OnboardingData
}) {
  const steps = [
    { key: "members", label: "Invite members", done: onboarding.hasMembers, href: `/circles/${circleId}/members`, icon: Users },
    { key: "plan", label: "Create a contribution plan", done: onboarding.hasPlan, href: `/circles/${circleId}/contributions`, icon: Repeat },
    { key: "contribution", label: "Record your first contribution", done: onboarding.hasContribution, href: `/circles/${circleId}/contributions`, icon: PiggyBank },
    { key: "goal", label: "Set a savings goal", done: onboarding.hasGoal, href: `/circles/${circleId}/goals`, icon: Target },
    { key: "expense", label: "Track an expense", done: onboarding.hasExpense, href: `/circles/${circleId}/expenses`, icon: Receipt },
    { key: "project", label: "Start a project", done: onboarding.hasProject, href: `/circles/${circleId}/projects/new`, icon: FolderKanban },
    { key: "event", label: "Schedule an event", done: onboarding.hasEvent, href: `/circles/${circleId}/events`, icon: Calendar },
  ]

  const pct = Math.round((onboarding.stepsCompleted / onboarding.totalSteps) * 100)

  return (
    <Card className="rounded-2xl border-brand-200 bg-brand-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-brand-800 flex items-center justify-between">
          <span>Setup Checklist</span>
          <span className="text-xs text-brand-600">{onboarding.stepsCompleted}/{onboarding.totalSteps} done</span>
        </CardTitle>
        <div className="h-1.5 w-full rounded-full bg-brand-100 mt-2">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((s) => (
          <Link
            key={s.key}
            href={s.done ? "#" : s.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              s.done
                ? "text-muted-foreground/60 cursor-default"
                : "hover:bg-brand-100/50 text-foreground"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <s.icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className={s.done ? "line-through" : ""}>{s.label}</span>
            {!s.done && (
              <span className="ml-auto text-xs text-brand font-medium">Go</span>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
