import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  PiggyBank,
  Clock,
  AlertTriangle,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import {
  getContributionSummary,
  getContributionPlans,
  getContributions,
} from "@/lib/services/contribution.service"
import { AddContributionForm } from "@/components/contributions/add-contribution-form"
import { CreateContributionPlanForm } from "@/components/contributions/create-contribution-plan-form"
import { ContributionPlanCard } from "@/components/contributions/contribution-plan-card"
import { ContributionHistoryTable } from "@/components/contributions/contribution-history-table"
import { MemberContributionSummary } from "@/components/contributions/member-contribution-summary"
import { CURRENCIES } from "@/lib/constants"

export default async function ContributionsPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle, summary, plans, contributions
  try {
    ;[circle, summary, plans, contributions] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getContributionSummary(circleId, session.user.id),
      getContributionPlans(circleId, session.user.id),
      getContributions(circleId, session.user.id),
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

  const plansForForm = plans.map((p) => ({
    id: p.id,
    name: p.name,
  }))

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
            <h1 className="text-2xl font-bold tracking-tight">
              Contributions
            </h1>
            <p className="text-muted-foreground">{circle.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <CreateContributionPlanForm circleId={circleId} />
          <AddContributionForm
            circleId={circleId}
            members={membersForForm}
            plans={plansForForm}
            currencySymbol={symbol}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
            <PiggyBank className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {symbol}
              {summary.totalPaid.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {symbol}
              {summary.totalPending.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expected (Plans)
            </CardTitle>
            <AlertTriangle className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {symbol}
              {summary.totalExpected.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
            <Users className="size-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {symbol}
              {summary.outstanding.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plans + History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Plans */}
          <div>
            <h2 className="mb-3 text-base font-semibold">
              Contribution Plans ({plans.length})
            </h2>
            {plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card py-12 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <PiggyBank className="size-6 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-medium">No plans yet</h4>
                <p className="text-xs text-muted-foreground">
                  Create a plan to define recurring contribution expectations
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => (
                  <ContributionPlanCard
                    key={plan.id}
                    plan={plan}
                    currencySymbol={symbol}
                  />
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">
                Contribution History ({contributions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <ContributionHistoryTable
                contributions={contributions}
                currencySymbol={symbol}
              />
            </CardContent>
          </Card>
        </div>

        {/* Member Summary Sidebar */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Member Summary</h2>
          <MemberContributionSummary
            members={summary.members}
            currencySymbol={symbol}
          />
        </div>
      </div>
    </div>
  )
}
