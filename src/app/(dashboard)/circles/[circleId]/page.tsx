import { notFound, redirect } from "next/navigation"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from "react"
import Link from "next/link"
import {
  ArrowLeft, Users, PiggyBank, Target, Settings, BookOpen, Repeat, TrendingUp, Clock, Lightbulb, Receipt, Scale, Check, FileText, Wallet, MessageCircle, Calendar, Vote, Sparkles, Zap, DollarSign, User, FolderKanban, MessageSquare, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleDashboard } from "@/lib/services/dashboard.service"
import { CircleTypeBadge } from "@/components/circles/circle-type-badge"
import { RoleBadge } from "@/components/circles/role-badge"
import { ContributionStatusBadge } from "@/components/contributions/contribution-status-badge"
import { GoalProgress } from "@/components/goals/goal-progress"
import { CircleSetupDetails } from "@/components/circles/circle-setup-details"
import { getAutomationLogs, getCircleWidgets } from "@/lib/services/circle-template.service"
import { TypeSpecificHero } from "@/components/circles/type-specific-hero"
import { CircleWidgetRenderer } from "@/components/circles/widgets/circle-widget-renderer"
import { PendingApprovalsWidget } from "@/components/approvals/pending-approvals-widget"
import { CircleOnboardingChecklist } from "@/components/circles/circle-onboarding-checklist"
import { WidgetGridSkeleton, CardSkeleton, ListSkeleton } from "@/components/shared/skeletons"
import { CURRENCIES } from "@/lib/constants"
import { getCircleTypeConfig } from "@/lib/circle-types"
import type { MemberRole } from "@/generated/prisma"

const tabIconMap: Record<string, React.ElementType> = {
  Users, PiggyBank, Target, BookOpen, Settings, TrendingUp, Receipt, Scale,
  Clock, Lightbulb, FileText, Wallet, MessageCircle, Calendar, Vote, Sparkles, Zap, DollarSign, User, FolderKanban,
}

export default async function CircleOverviewPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle: any, dashboard: any, widgets: any, automationLogs: any, pageError: string | null = null
  try {
    ;[dashboard, widgets, automationLogs, circle] = await Promise.all([
      getCircleDashboard(circleId, session.user.id),
      getCircleWidgets(circleId),
      getAutomationLogs(circleId),
      getCircleById(circleId, session.user.id),
    ])
  } catch (e) {
    pageError = (e as Error).message
    console.error("CircleOverview error:", e)
  }

  const currency = circle ? CURRENCIES.find((c) => c.code === circle.currency) : null
  const symbol = currency?.symbol ?? circle?.currency ?? "R"
  const canManage = circle
    ? circle.userRole === "OWNER" || circle.userRole === "ADMIN"
    : false
  const ds = dashboard?.circleStats

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            render={<Link href="/circles" />}
            variant="outline"
            size="icon"
            className="rounded-xl"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {circle.name}
              </h1>
              <CircleTypeBadge type={circle.type} />
            </div>
            {circle.description && (
              <p className="text-muted-foreground">{circle.description}</p>
            )}
          </div>
        </div>
        {canManage && (
          <Button
            render={<Link href={`/circles/${circle.id}/manage`} />}
            variant="outline"
            size="sm"
            className="rounded-xl"
          >
            <Settings className="mr-2 size-4" />
            Manage
          </Button>
        )}
      </div>

      {/* Error state */}
      {pageError && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div><p className="font-medium text-amber-800">Could not load circle</p><p className="text-xs text-amber-700 mt-1">{pageError}</p></div>
        </CardContent></Card>
      )}
      {!pageError && circle && (<>
      {/* Type-Specific Hero */}
      <TypeSpecificHero
        circle={{ id: circle.id, name: circle.name, type: circle.type, currency: circle.currency, settings: (circle as unknown as { settings: Record<string, unknown> | null }).settings, memberCount: circle.memberCount }}
        stats={ds}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          label="Total Pool"
          value={`${symbol}${ds.totalContributions.toLocaleString()}`}
          icon={<PiggyBank className="size-5" />}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCell
          label="Members"
          value={ds.totalMembers.toString()}
          icon={<Users className="size-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCell
          label="Wallet Balance"
          value={`${symbol}${ds.walletBalance.toLocaleString()}`}
          icon={<Wallet className="size-5" />}
          color="bg-violet-50 text-violet-600"
        />
        <StatCell
          label="Active Goals"
          value={ds.activeGoals.toString()}
          icon={<Target className="size-5" />}
          color="bg-brand-50 text-brand"
        />
        {ds.totalInvested !== undefined && ds.totalInvested !== null && (
          <StatCell
            label="Total Invested"
            value={`${symbol}${ds.totalInvested.toLocaleString()}`}
            icon={<TrendingUp className="size-5" />}
            color="bg-amber-50 text-amber-600"
          />
        )}
        {ds.totalReturns !== undefined && ds.totalReturns !== null && (
          <StatCell
            label="Total Returns"
            value={`${symbol}${ds.totalReturns.toLocaleString()}`}
            icon={<DollarSign className="size-5" />}
            color="bg-emerald-50 text-emerald-600"
          />
        )}
      </div>

      {/* Onboarding Checklist */}
      {dashboard.onboarding.stepsCompleted < dashboard.onboarding.totalSteps && (
        <CircleOnboardingChecklist
          circleId={circleId}
          onboarding={dashboard.onboarding}
        />
      )}

      {/* Goal Progress Bar */}
      {ds.totalGoalTarget > 0 && (
        <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium text-brand-800">
              Goal Progress — {symbol}{ds.totalGoalSaved.toLocaleString()} of{" "}
              {symbol}{ds.totalGoalTarget.toLocaleString()}
            </p>
            <GoalProgress current={ds.totalGoalSaved} target={ds.totalGoalTarget} size="lg" />
          </CardContent>
        </Card>
      )}

      <CircleSetupDetails
        type={circle.type}
        settings={(circle as unknown as { settings: Record<string, unknown> | null }).settings || null}
        currency={circle.currency}
      />

      {/* Automation Status */}
      {automationLogs.length > 0 && (
        <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
          <CardHeader>
            <CardTitle className="text-base text-brand-800">
              Your {getCircleTypeConfig(circle.type).label} setup is ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {automationLogs.filter((l: { status: string }) => l.status === "SUCCESS").slice(0, 6).map((log: { id: string; message: string }) => (
                <div key={log.id} className="flex items-center gap-2 text-sm text-brand-700">
                  <Check className="size-3.5 shrink-0" /> {log.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets Grid */}
      <Suspense fallback={<WidgetGridSkeleton count={3} />}>
      {widgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.map((w: any) => (
            <CircleWidgetRenderer
              key={w.id}
              widget={w}
              circle={{ id: circle.id, currency: circle.currency, type: circle.type, settings: (circle as unknown as { settings: Record<string, unknown> | null }).settings }}
              stats={ds}
            />
          ))}
        </div>
      )}
      </Suspense>

      {/* Next Actions */}
      <div className="flex flex-wrap gap-2">
        <Button render={<Link href={`/circles/${circleId}/members`} />} variant="outline" size="sm" className="rounded-xl">
          <Users className="size-3.5 mr-1" /> Invite Members
        </Button>
        <Button render={<Link href={`/circles/${circleId}/contributions`} />} variant="outline" size="sm" className="rounded-xl">
          <PiggyBank className="size-3.5 mr-1" /> Add Contribution
        </Button>
        <Button render={<Link href={`/circles/${circleId}/goals`} />} variant="outline" size="sm" className="rounded-xl">
          <Target className="size-3.5 mr-1" /> View Goals
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Contributions */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Contributions</CardTitle>
              <Button
                render={<Link href={`/circles/${circleId}/contributions`} />}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recentContributions.length === 0 ? (
                <EmptyRow icon={<PiggyBank />} text="No contributions yet" />
              ) : (
                <div className="space-y-2">
                  {dashboard.recentContributions.map((c: any) => {
                    const initials = c.user.name
                      ? c.user.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "??"
                    return (
                      <div key={c.id} className="flex items-center gap-3 text-sm">
                        <Avatar className="size-7">
                          <AvatarImage src={c.user.image || ""} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{c.user.name || "Member"}</span>
                        <span className="font-mono font-semibold text-emerald-600">
                          {symbol}{c.amount.toLocaleString()}
                        </span>
                        <ContributionStatusBadge status={c.status} />
                        <span className="hidden sm:inline text-xs text-muted-foreground w-20 text-right">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Allocations */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Goal Allocations</CardTitle>
              <Button
                render={<Link href={`/circles/${circleId}/goals`} />}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recentAllocations.length === 0 ? (
                <EmptyRow icon={<Target />} text="No allocations yet" />
              ) : (
                <div className="space-y-2">
                  {dashboard.recentAllocations.map((a: any) => {
                    const initials = a.user.name
                      ? a.user.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "??"
                    return (
                      <div key={a.id} className="flex items-center gap-3 text-sm">
                        <Avatar className="size-7">
                          <AvatarImage src={a.user.image || ""} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{a.user.name || "Member"}</span>
                          <span className="text-xs text-muted-foreground truncate block">
                            → {a.goal.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-brand shrink-0">
                          +{symbol}{a.amount.toLocaleString()}
                        </span>
                        <span className="hidden sm:inline text-xs text-muted-foreground w-20 text-right">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Expenses */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Expenses</CardTitle>
              <Button
                render={<Link href={`/circles/${circleId}/expenses`} />}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recentExpenses.length === 0 ? (
                <EmptyRow icon={<Receipt />} text="No expenses yet" />
              ) : (
                <div className="space-y-2">
                  {dashboard.recentExpenses.map((e: any) => {
                    const initials = e.paidBy.name
                      ? e.paidBy.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "??"
                    return (
                      <div key={e.id} className="flex items-center gap-3 text-sm">
                        <Avatar className="size-7">
                          <AvatarImage src={e.paidBy.image || ""} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{e.title}</span>
                          <span className="text-xs text-muted-foreground">{e.category}</span>
                        </div>
                        <span className="font-mono font-semibold text-rose-600 shrink-0">
                          {symbol}{e.amount.toLocaleString()}
                        </span>
                        <span className="hidden sm:inline text-xs text-muted-foreground w-20 text-right">
                          {new Date(e.expenseDate).toLocaleDateString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Projects */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Projects</CardTitle>
              <Button
                render={<Link href={`/circles/${circleId}/projects`} />}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recentProjects.length === 0 ? (
                <EmptyRow icon={<FolderKanban />} text="No projects yet" />
              ) : (
                <div className="space-y-2">
                  {dashboard.recentProjects.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 text-sm">
                      <FolderKanban className="size-4 text-muted-foreground shrink-0" />
                      <Link
                        href={`/circles/${circleId}/projects/${p.id}`}
                        className="flex-1 truncate font-medium hover:text-brand transition-colors"
                      >
                        {p.name}
                      </Link>
                      <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      <span className="hidden sm:inline text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Circle Details */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Currency" value={`${symbol} ${circle.currency}`} />
              <Row label="Your Role" value={<RoleBadge role={circle.userRole as MemberRole} />} />
              <Row label="Members" value={`${ds.totalMembers}`} />
              {ds.activePlans > 0 && <Row label="Active Plans" value={ds.activePlans.toString()} />}
              {ds.pendingSettlements > 0 && (
                <Row label="Pending Settlements" value={<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{ds.pendingSettlements}</Badge>} />
              )}
              {ds.pendingInvitations > 0 && (
                <Row label="Pending Invites" value={<Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{ds.pendingInvitations}</Badge>} />
              )}
              {ds.pendingJoinRequests > 0 && (
                <Row label="Join Requests" value={<Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">{ds.pendingJoinRequests}</Badge>} />
              )}
              {ds.activePolls > 0 && <Row label="Active Polls" value={ds.activePolls.toString()} />}
              {ds.goalProgress > 0 && <Row label="Goal Progress" value={`${ds.goalProgress}%`} />}
              {ds.totalGoalTarget > 0 && (
                <Row label="Goal Target" value={`${symbol}${ds.totalGoalTarget.toLocaleString()}`} />
              )}
              <Row label="Created" value={new Date(circle.createdAt).toLocaleDateString()} />
              <Row
                label="Status"
                value={
                  <Badge
                    variant="outline"
                    className={
                      circle.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }
                  >
                    {circle.isActive ? "Active" : "Inactive"}
                  </Badge>
                }
              />
            </CardContent>
          </Card>

          {/* Dynamic Tabs */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {getCircleTypeConfig(circle.type).tabs.map((tab) => {
                const Icon = tabIconMap[tab.icon] || Settings
                return (
                  <QuickLink
                    key={tab.key}
                    href={`/circles/${circleId}${tab.href}`}
                    icon={<Icon className="size-4" />}
                    label={tab.label}
                  />
                )
              })}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          {dashboard.upcomingEvents.length > 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Upcoming Events</CardTitle>
                <Button
                  render={<Link href={`/circles/${circleId}/events`} />}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  View all
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard.upcomingEvents.map((ev: any) => (
                    <div key={ev.id} className="flex items-start gap-3 text-sm">
                      <Calendar className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ev.startAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity / Feed Posts */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Button
                render={<Link href={`/circles/${circleId}/feed`} />}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recentFeedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <MessageSquare className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentFeedPosts.map((p: any) => {
                    const initials = p.author.name
                      ? p.author.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "??"
                    return (
                      <Link
                        key={p.id}
                        href={`/circles/${circleId}/feed`}
                        className="flex items-start gap-2 text-sm group"
                      >
                        <Avatar className="size-6 shrink-0">
                          <AvatarImage src={p.author.image || ""} />
                          <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors">
                            {p.content}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <PendingApprovalsWidget circleId={circleId} />
        </div>
      </div>
      </>
      )}
    </div>
  )
}

function StatCell({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className={`flex size-9 items-center justify-center rounded-lg ${color}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  label,
  disabled,
}: {
  href: string
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <Button
      render={disabled ? undefined : <Link href={href} />}
      variant="outline"
      disabled={disabled}
      className="w-full justify-start gap-2 rounded-xl"
    >
      {icon}
      {label}
      {disabled && (
        <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
      )}
    </Button>
  )
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
