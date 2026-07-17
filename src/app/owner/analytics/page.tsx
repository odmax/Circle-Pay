import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Globe, TrendingUp, DollarSign, MessageCircle, Calendar, Vote, PiggyBank, Target, Wallet, AlertTriangle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function OwnerAnalyticsPage() {
  await requireOwnerPage(PERMISSIONS.ANALYTICS_VIEW)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let totalUsers = 0, newUsersMonth = 0, totalCircles = 0, newCirclesMonth = 0, publicCircles = 0, paidUsers = 0
  let totalRevenue: { _sum: { amount: any } } = { _sum: { amount: 0 } }, feedPosts = 0, events = 0, polls = 0, joinRequests = 0, contributions = 0, goals = 0, walletTxs = 0
  let subs: { planId: string; _count: number }[] = [], plans: { id: string; name: string; slug: string }[] = [], circleTypeData: { type: string; count: number }[] = [], topCountries: { country: string | null; _count: number }[] = []
  try {
    let subsRaw: { planId: string; _count: number }[]
    ;[totalUsers, newUsersMonth, totalCircles, newCirclesMonth, publicCircles, paidUsers, totalRevenue, feedPosts, events, polls, joinRequests, contributions, goals, walletTxs, subsRaw] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.circle.count({ where: { isActive: true } }),
      prisma.circle.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.circle.count({ where: { visibility: "PUBLIC", isActive: true } }),
      prisma.userSubscription.count({ where: { status: "ACTIVE", plan: { slug: { not: "free" } } } }),
      prisma.paymentTransaction.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      prisma.feedPost.count({ where: { deletedAt: null } }),
      prisma.circleEvent.count({ where: { deletedAt: null } }),
      prisma.circlePoll.count({ where: { deletedAt: null } }),
      prisma.joinRequest.count(),
      prisma.contribution.count({ where: { deletedAt: null } }),
      prisma.goal.count({ where: { deletedAt: null } }),
      prisma.walletTransaction.count(),
      prisma.userSubscription.groupBy({ by: ["planId"], _count: true }),
    ])
    subs = subsRaw
    plans = await prisma.plan.findMany({ select: { id: true, name: true, slug: true } })

    const circleTypes = await prisma.circle.groupBy({ by: ["type"], where: { isActive: true }, _count: true })
    circleTypeData = circleTypes.map((c) => ({ type: c.type, count: c._count })).sort((a, b) => b.count - a.count)

    const countries = await prisma.circle.groupBy({ by: ["country"], where: { isActive: true, country: { not: null } }, _count: true })
    topCountries = countries.sort((a, b) => b._count - a._count).slice(0, 10)
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Unable to load analytics</h2><p className="text-sm text-muted-foreground mt-1">The analytics data could not be retrieved.</p></div>
          <a href="/owner/analytics" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  const planBreakdown = subs.map((s) => ({ plan: plans.find((p) => p.id === s.planId)?.name || "?", count: s._count }))

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Analytics</h1><p className="text-muted-foreground">Platform growth, engagement, and conversion</p></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground uppercase">Total Users</span><Users className="size-4 text-blue-500" /></div><div className="text-2xl font-bold">{totalUsers}</div><p className="text-xs text-muted-foreground">+{newUsersMonth} this month</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground uppercase">Total Circles</span><Globe className="size-4 text-violet-500" /></div><div className="text-2xl font-bold">{totalCircles}</div><p className="text-xs text-muted-foreground">+{newCirclesMonth} this month · {publicCircles} public</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground uppercase">Paid Users</span><DollarSign className="size-4 text-emerald-500" /></div><div className="text-2xl font-bold">{paidUsers}</div><p className="text-xs text-muted-foreground">{totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0}% conversion</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground uppercase">Revenue</span><TrendingUp className="size-4 text-brand" /></div><div className="text-2xl font-bold">R{Number(totalRevenue._sum.amount ?? 0).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Circle Types */}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Circle Types</CardTitle></CardHeader><CardContent>
          <div className="space-y-2">{circleTypeData.map((t) => {
            const max = circleTypeData[0]?.count || 1; const pct = Math.round((t.count / max) * 100)
            return <div key={t.type} className="space-y-1"><div className="flex justify-between text-sm"><span>{t.type.charAt(0) + t.type.slice(1).toLowerCase()}</span><span className="font-medium">{t.count}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div></div>
          })}</div>
        </CardContent></Card>

        {/* Top Countries */}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Top Countries</CardTitle></CardHeader><CardContent>
          <div className="space-y-2">{topCountries.map((c) => (
            <div key={c.country || "?"} className="flex justify-between text-sm"><span>{c.country}</span><span className="font-medium">{c._count}</span></div>
          ))}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement */}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Engagement</CardTitle></CardHeader><CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><MessageCircle className="size-4 text-blue-500" /> Feed Posts</span><span className="font-bold">{feedPosts}</span></div>
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><Calendar className="size-4 text-rose-500" /> Events</span><span className="font-bold">{events}</span></div>
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><Vote className="size-4 text-amber-500" /> Polls</span><span className="font-bold">{polls}</span></div>
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><Users className="size-4 text-violet-500" /> Join Requests</span><span className="font-bold">{joinRequests}</span></div>
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><PiggyBank className="size-4 text-emerald-500" /> Contributions</span><span className="font-bold">{contributions}</span></div>
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><Target className="size-4 text-brand" /> Goals</span><span className="font-bold">{goals}</span></div>
            <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><Wallet className="size-4 text-indigo-500" /> Wallet Txs</span><span className="font-bold">{walletTxs}</span></div>
          </div>
        </CardContent></Card>

        {/* Subscriptions */}
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Subscription Plans</CardTitle></CardHeader><CardContent>
          <div className="space-y-2">{planBreakdown.map((p) => (
            <div key={p.plan} className="flex justify-between text-sm"><span>{p.plan}</span><Badge variant="outline">{p.count}</Badge></div>
          ))}</div>
        </CardContent></Card>
      </div>
    </div>
  )
}
