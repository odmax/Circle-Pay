// Pure, dependency-free travel metric helpers (unit-testable).

export interface TravelCountdown {
  daysToStart: number
  daysLeft: number
  inProgress: boolean
  completed: boolean
  label: string
}

export function computeTripCountdown(
  startDate: string | Date | null,
  endDate: string | Date | null,
  status: string,
): TravelCountdown {
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  const now = new Date()
  const day = 86400000
  const daysToStart = start ? Math.max(0, Math.round((start.getTime() - now.getTime()) / day)) : 0
  const daysLeft = end ? Math.max(0, Math.round((end.getTime() - now.getTime()) / day)) : 0
  const inProgress = !!start && start.getTime() <= now.getTime() && !!end && end.getTime() >= now.getTime()
  const completed = status === "COMPLETED"

  let label: string
  if (completed) label = "Trip completed"
  else if (inProgress) label = `On trip · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
  else if (daysToStart === 0 && start) label = "Trip starts today"
  else if (daysToStart > 0) label = `Starts in ${daysToStart} day${daysToStart === 1 ? "" : "s"}`
  else if (status === "PLANNING") label = "Planning — no date set"
  else label = "No dates set"

  return { daysToStart, daysLeft, inProgress, completed, label }
}

export interface TravelBudget {
  collected: number
  spent: number
  remaining: number
  collectionPct: number
  budgetUsedPct: number
  budgetRemainingPct: number
  membersPaid: number
  membersOutstanding: number
}

export function computeTravelBudget(input: {
  collected: number
  spent: number
  totalBudget: number
  contributionTarget: number
  memberCount: number
  membersPaid: number
}): TravelBudget {
  const budget = Math.max(0, input.totalBudget)
  const target = Math.max(0, input.contributionTarget)
  const base = target > 0 ? target : budget
  const collectionPct = base > 0 ? Math.min(100, Math.round((input.collected / base) * 100)) : 0
  const budgetUsedPct = budget > 0 ? Math.min(100, Math.round((input.spent / budget) * 100)) : 0
  const remaining = input.collected - input.spent
  const membersOutstanding = Math.max(0, input.memberCount - input.membersPaid)
  return {
    collected: input.collected,
    spent: input.spent,
    remaining,
    collectionPct,
    budgetUsedPct,
    budgetRemainingPct: budget > 0 ? Math.max(0, 100 - budgetUsedPct) : 0,
    membersPaid: input.membersPaid,
    membersOutstanding,
  }
}

export function computeMyTravelPosition(input: {
  myPaid: number
  myPending: number
  contributionTarget: number
  memberCount: number
  myExpenseShare: number
}): { myShareTarget: number; myOutstanding: number; myTripBalance: number; myStatus: string } {
  const memberCount = Math.max(1, input.memberCount)
  const myShareTarget = input.contributionTarget > 0 ? Math.round((input.contributionTarget / memberCount) * 100) / 100 : 0
  const myOutstanding = Math.max(0, Math.round((myShareTarget - input.myPaid) * 100) / 100)
  const myTripBalance = Math.round((input.myPaid - input.myExpenseShare) * 100) / 100
  let myStatus = "No contribution yet"
  if (input.myPaid > 0 && input.myPending === 0) myStatus = "Paid in full"
  else if (input.myPending > 0) myStatus = "Payment pending review"
  return { myShareTarget, myOutstanding, myTripBalance, myStatus }
}

export interface TravelAlert {
  id: string
  level: "info" | "warning" | "risk"
  title: string
  description: string
}

export function computeTravelAlerts(input: {
  countdown: TravelCountdown
  budget: TravelBudget
  contributionTarget: number
  deadlines: Array<{ id: string; name: string; amount: number; dueDate: string | null }>
  events: Array<{ id: string; title: string; startAt: string }>
  openPollsNotVoted: number
  myPendingWithProof: boolean
  myPendingWithoutProof: boolean
}): TravelAlert[] {
  const alerts: TravelAlert[] = []
  const now = Date.now()
  const day = 86400000

  if (input.countdown.daysToStart > 0 && input.countdown.daysToStart <= 7 && !input.countdown.inProgress) {
    alerts.push({ id: "trip-start", level: "warning", title: "Trip starts soon", description: `Your trip begins in ${input.countdown.daysToStart} day(s).` })
  }

  for (const d of input.deadlines) {
    if (!d.dueDate) continue
    const diff = new Date(d.dueDate).getTime() - now
    if (diff >= 0 && diff <= 3 * day) {
      alerts.push({ id: `due-${d.id}`, level: "warning", title: `Contribution due soon: ${d.name}`, description: `${d.amount.toLocaleString()} due in ${Math.max(1, Math.round(diff / day))} day(s).` })
    } else if (diff < 0) {
      alerts.push({ id: `overdue-${d.id}`, level: "risk", title: `Contribution overdue: ${d.name}`, description: "This scheduled contribution is past due." })
    }
  }

  if (input.budget.budgetUsedPct >= 80) {
    alerts.push({ id: "budget", level: "warning", title: "Budget nearing limit", description: `${input.budget.budgetUsedPct}% of the trip budget is used.` })
  }

  for (const e of input.events) {
    const diff = new Date(e.startAt).getTime() - now
    if (diff >= 0 && diff <= 3 * day) {
      alerts.push({ id: `event-${e.id}`, level: "info", title: `Event approaching: ${e.title}`, description: "An important event is coming up soon." })
    }
  }

  if (input.openPollsNotVoted > 0) {
    alerts.push({ id: "polls", level: "info", title: "Poll awaiting your vote", description: `${input.openPollsNotVoted} open poll(s) need your decision.` })
  }

  if (input.myPendingWithoutProof) {
    alerts.push({ id: "proof", level: "warning", title: "Missing payment proof", description: "Upload proof for your pending trip payment." })
  }

  return alerts
}

export function formatTripCurrency(amount: number, code: string): string {
  return `${code === "ZAR" ? "R" : code + " "}${(Number(amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}