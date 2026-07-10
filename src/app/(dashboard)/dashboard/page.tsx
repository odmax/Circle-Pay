import { redirect } from "next/navigation"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Users, PiggyBank, Target, AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { getUserDashboard } from "@/lib/services/dashboard.service"
import { getDashboardSnapshot, refreshDashboardSnapshot } from "@/lib/services/snapshot.service"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions"
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed"
import { CircleSummaryCard } from "@/components/dashboard/circle-summary-card"
import { CURRENCIES } from "@/lib/constants"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NoCirclesEmpty, DashboardOnboardingChecklist } from "@/components/ui/app/empty-state-presets"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Serve cached snapshot immediately; background refresh if stale
  let data = await getDashboardSnapshot(session.user.id)
  if (!data) {
    data = await getUserDashboard(session.user.id)
    refreshDashboardSnapshot(session.user.id, data).catch(console.error)
  }
  const { stats, userCircles, recentActivity } = data

  const hasCircles = userCircles.length > 0
  const userCurrency = session.user.currency || "NGN"
  const currency = CURRENCIES.find((c) => c.code === userCurrency)
  const symbol = currency?.symbol ?? "$"

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {session.user.name ? `Hello, ${session.user.name.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {hasCircles
            ? `You have ${stats.totalCircles} circle${stats.totalCircles !== 1 ? "s" : ""} with ${symbol}${stats.totalContributions.toLocaleString()} total pool`
            : "Welcome to Circle Pay. Start by creating a circle."}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="My Circles"
          value={stats.totalCircles.toString()}
          icon={<Users className="size-5" />}
          trend="Groups you belong to"
        />
        <DashboardStatCard
          title="Total Pool"
          value={`${symbol}${stats.totalCirclePool.toLocaleString()}`}
          icon={<PiggyBank className="size-5" />}
          colorClass="bg-emerald-50 text-emerald-600"
          trend="Across all circles"
        />
        <DashboardStatCard
          title="Active Goals"
          value={stats.activeGoals.toString()}
          icon={<Target className="size-5" />}
          colorClass="bg-blue-50 text-blue-600"
          trend={stats.completedGoals > 0 ? `${stats.completedGoals} completed` : "Goals in progress"}
        />
        <DashboardStatCard
          title="Pending"
          value={`${symbol}${stats.pendingContributions.toLocaleString()}`}
          icon={<AlertTriangle className="size-5" />}
          colorClass={stats.pendingContributions > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}
          trend="Pending contributions"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Circles list */}
          {hasCircles ? (
            <div>
              <h2 className="text-base font-semibold mb-3">Your Circles</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {userCircles.map((c: any) => {
                  const ccy = CURRENCIES.find((cur) => cur.code === c.currency)
                  return (
                    <CircleSummaryCard
                      key={c.id}
                      circle={c}
                      currencySymbol={ccy?.symbol ?? c.currency}
                    />
                  )
                })}
              </div>
            </div>
          ) : (
            <NoCirclesEmpty />
          )}

          {/* Goal Progress Bar */}
          {stats.totalGoalTarget > 0 && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/20 p-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-brand-800">Overall Goal Progress</span>
                <span className="text-brand-700 font-semibold">
                  {stats.totalGoalTarget > 0
                    ? Math.min(100, Math.round((stats.totalGoalSaved / stats.totalGoalTarget) * 100))
                    : 0}
                  %
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-3 rounded-full bg-brand transition-all duration-500"
                  style={{
                    width: `${stats.totalGoalTarget > 0
                      ? Math.min(100, Math.round((stats.totalGoalSaved / stats.totalGoalTarget) * 100))
                      : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-brand-700">
                {symbol}{stats.totalGoalSaved.toLocaleString()} of{" "}
                {symbol}{stats.totalGoalTarget.toLocaleString()} saved
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <DashboardQuickActions hasCircles={hasCircles} />
          <RecentActivityFeed
            activities={recentActivity}
            currencySymbol={symbol}
          />
        </div>
      </div>
    </div>
  )
}
