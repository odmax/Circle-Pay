import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  PiggyBank,
  Clock,
  AlertTriangle,
  Users,
  AlertCircle,
  CalendarClock,
  CalendarX2,
  Hourglass,
  TrendingUp,
  ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import {
  getContributionSummary,
  getContributionPlans,
  getContributions,
  getMemberOwnContributions,
  getMemberOwnContributionStats,
} from "@/lib/services/contribution.service"
import { getContributionSchedules } from "@/lib/services/contribution-schedule.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { AddContributionForm } from "@/components/contributions/add-contribution-form"
import { SelfServiceContributionForm } from "@/components/contributions/self-service-contribution-form"
import { CreateContributionPlanForm } from "@/components/contributions/create-contribution-plan-form"
import { CreateContributionScheduleForm } from "@/components/contributions/create-contribution-schedule-form"
import { ContributionPlanCard } from "@/components/contributions/contribution-plan-card"
import { ContributionScheduleCard } from "@/components/contributions/contribution-schedule-card"
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

  let circle: any
  let pageError: string | null = null
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch (e) {
    pageError = (e as Error).message
    console.error("Circle fetch error:", e)
  }

  if (!circle) {
    notFound()
  }

  const currency = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = currency?.symbol ?? circle.currency ?? "R"

  const canViewAll = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL,
  })

  const canSubmitOwn = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN,
  })

  const canManage = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW,
  })

  const canManageSchedules = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.SCHEDULE_MANAGE,
  })

  const canCreatePlan = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE,
  })

  let plans: any[] = []
  let schedules: any[] = []
  let summary: any = null
  let ownStats: any = null
  let contributions: any[] = []

  try {
    if (canViewAll) {
      ;[summary, plans, contributions, schedules] = await Promise.all([
        getContributionSummary(circleId, session.user.id),
        getContributionPlans(circleId, session.user.id),
        getContributions(circleId, session.user.id),
        getContributionSchedules(circleId, session.user.id),
      ])
    } else {
      ;[ownStats, plans, contributions, schedules] = await Promise.all([
        getMemberOwnContributionStats(circleId, session.user.id),
        getContributionPlans(circleId, session.user.id).catch(() => []),
        getMemberOwnContributions(circleId, session.user.id),
        getContributionSchedules(circleId, session.user.id).catch(() => []),
      ])
    }
  } catch (e) {
    pageError = (e as Error).message
    console.error("Contributions error:", e)
  }

  const plansForForm =
    plans?.map((p: any) => ({ id: p.id, name: p.name })) ?? []

  const membersForForm =
    circle?.members?.map((m: any) => ({
      id: m.user.id,
      name: m.user.name || m.user.email,
    })) ?? []

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
            <h1 className="text-2xl font-bold tracking-tight">Contributions</h1>
            <p className="text-muted-foreground">{circle?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canManageSchedules && (
            <CreateContributionScheduleForm
              circleId={circleId}
              currencySymbol={symbol}
            />
          )}
          {canCreatePlan && <CreateContributionPlanForm circleId={circleId} />}
          {canManage && (
            <AddContributionForm
              circleId={circleId}
              members={membersForForm}
              plans={plansForForm}
              currencySymbol={symbol}
            />
          )}
          {!canManage && canSubmitOwn && (
            <SelfServiceContributionForm
              circleId={circleId}
              plans={plansForForm}
              currencySymbol={symbol}
            />
          )}
        </div>
      </div>

      {/* Error state */}
      {pageError && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/20">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                Could not load contributions
              </p>
              <p className="text-xs text-amber-700 mt-1">{pageError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin/Owner: full summary */}
      {!pageError && canViewAll && summary && (
        <>
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

          {/* Schedule Dashboard Widgets */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming
                </CardTitle>
                <CalendarClock className="size-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {symbol}
                  {summary.upcoming.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  scheduled contributions
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Due Today
                </CardTitle>
                <Hourglass className="size-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {symbol}
                  {summary.dueToday.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.dueTodayCount} contribution
                  {summary.dueTodayCount === 1 ? "" : "s"} due today
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue
                </CardTitle>
                <CalendarX2 className="size-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {symbol}
                  {summary.overdue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.membersOutstanding} member
                  {summary.membersOutstanding === 1 ? "" : "s"} outstanding
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Month&apos;s Collection
                </CardTitle>
                <TrendingUp className="size-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {summary.collectionRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  of {symbol}
                  {summary.expectedThisMonth.toLocaleString()} collected
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Collection Progress */}
          <Card className="rounded-2xl border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <ListChecks className="size-4 text-blue-500" />
                  Collection Progress
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {summary.collectionProgress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, summary.collectionProgress)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {symbol}
                {summary.totalPaid.toLocaleString()} collected toward {symbol}
                {summary.due.toLocaleString()} due + {symbol}
                {summary.overdue.toLocaleString()} overdue
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Member self-service stats */}
      {!pageError && !canViewAll && ownStats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  My Total Paid
                </CardTitle>
                <PiggyBank className="size-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {symbol}
                  {ownStats.totalPaid.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  My Pending
                </CardTitle>
                <Clock className="size-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {symbol}
                  {ownStats.totalPending.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  My Outstanding
                </CardTitle>
                <AlertTriangle className="size-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {symbol}
                  {ownStats.outstanding.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  My Due / Overdue
                </CardTitle>
                <CalendarX2 className="size-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {symbol}
                  {(ownStats.due + ownStats.overdue).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {(ownStats.due > 0 || ownStats.overdue > 0) && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">
                      You have outstanding contributions
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {ownStats.due > 0 &&
                        `${symbol}${ownStats.due.toLocaleString()} due. `}
                      {ownStats.overdue > 0 &&
                        `${symbol}${ownStats.overdue.toLocaleString()} overdue. `}
                      Submit your contribution above to stay in good standing.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Content Grid */}
      <div
        className={
          "grid gap-6 " + (canViewAll ? "lg:grid-cols-3" : "lg:grid-cols-1")
        }
      >
        <div
          className={
            canViewAll ? "lg:col-span-2 space-y-6" : "space-y-6"
          }
        >
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
                {plans.map((plan: any) => (
                  <ContributionPlanCard
                    key={plan.id}
                    plan={plan}
                    currencySymbol={symbol}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Schedules */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Schedules ({schedules.length})
              </h2>
              {canManageSchedules && (
                <CreateContributionScheduleForm
                  circleId={circleId}
                  currencySymbol={symbol}
                />
              )}
            </div>
            {schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card py-10 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <CalendarClock className="size-6 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-medium">No schedules yet</h4>
                <p className="text-xs text-muted-foreground">
                  Create a schedule to auto-generate contribution records and
                  reminders
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {schedules.map((schedule: any) => (
                  <ContributionScheduleCard
                    key={schedule.id}
                    circleId={circleId}
                    schedule={schedule}
                    currencySymbol={symbol}
                    canManage={canManageSchedules}
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
                circleId={circleId}
                contributions={contributions}
                currencySymbol={symbol}
                plans={plansForForm}
                canManage={canManage}
                showDeletedToggle={canManage}
              />
            </CardContent>
          </Card>
        </div>

        {/* Member Summary Sidebar — admin/owner only */}
        {canViewAll && summary && (
          <div>
            <h2 className="mb-3 text-base font-semibold">Member Summary</h2>
            <MemberContributionSummary
              members={summary.members}
              currencySymbol={symbol}
              circleId={circleId}
            />
          </div>
        )}
      </div>
    </div>
  )
}
