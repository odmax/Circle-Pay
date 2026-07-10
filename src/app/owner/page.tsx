import { getOwnerDashboard } from "@/lib/services/owner.service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Users, Globe, Crown, DollarSign, TrendingUp, Sparkles, UserPlus, ShieldCheck, FileText, AlertTriangle, UserCheck, Wallet, Activity, ArrowRight } from "lucide-react"
import { AppPage, PageHeader, StatCard, MetricCard, SectionHeader, StatusBadge } from "@/components/ui/app"

export default async function OwnerOverviewPage() {
  const d = await getOwnerDashboard()

  return (
    <AppPage>
      <PageHeader
        title="Circle Pay"
        description={`${d.todayPayments} payments today · ${d.premiumUsers + d.communityUsers} paid users · ${d.totalCircles} circles`}
        actions={<><Button render={<Link href="/owner/health" />} variant="outline" size="sm" className="rounded-xl"><Activity className="size-4 mr-1" /> Health</Button><Button render={<Link href="/owner/revenue" />} size="sm" className="rounded-xl bg-brand hover:bg-brand-600"><DollarSign className="size-4 mr-1" /> Revenue</Button></>}
      />

      {/* Platform KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={d.totalUsers} icon={Users} />
        <StatCard label="Active Users" value={d.activeUsers} icon={UserCheck} />
        <StatCard label="Total Circles" value={d.totalCircles} icon={Globe} />
        <StatCard label="Paid Users" value={d.premiumUsers + d.communityUsers} icon={Crown} sub={`${d.premiumUsers} Premium + ${d.communityUsers} Community`} />
      </div>

      {/* Revenue KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={`R${d.totalRevenue.toLocaleString()}`} icon={DollarSign} trend="up" />
        <StatCard label="MRR" value={`R${d.mrr.toLocaleString()}`} icon={TrendingUp} sub="This month" />
        <StatCard label="Today Revenue" value={`R${d.todayRevenue.toLocaleString()}`} icon={Sparkles} sub={`${d.todayPayments} payments`} />
        <StatCard label="Wallet Volume" value={`R${d.totalWalletVolume.toLocaleString()}`} icon={Wallet} sub="All confirmed txs" />
      </div>

      {/* Operations KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Verified Circles" value={d.verifiedCircles} icon={ShieldCheck} className="text-emerald-600" />
        <MetricCard label="Public Circles" value={d.publicCircles} icon={Globe} />
        <MetricCard label="Pending Verifications" value={d.pendingVerifications} icon={d.pendingVerifications > 0 ? AlertTriangle : ShieldCheck} className={d.pendingVerifications > 0 ? "text-amber-600" : "text-emerald-600"} />
        <MetricCard label="Pending Join Requests" value={d.pendingJoinRequests} icon={d.pendingJoinRequests > 0 ? AlertTriangle : UserPlus} className={d.pendingJoinRequests > 0 ? "text-amber-600" : ""} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <SectionHeader title="Activity Feed" actions={<Link href="/owner/audit-logs" className="text-xs text-brand hover:underline">View all</Link>} />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {d.activityFeed.map((a, i) => {
                const icons: Record<string, React.ReactNode> = { user: <UserPlus className="size-4" />, payment: <DollarSign className="size-4" />, circle: <Globe className="size-4" /> }
                const colors: Record<string, string> = { user: "bg-blue-50 text-blue-600", payment: "bg-emerald-50 text-emerald-600", circle: "bg-violet-50 text-violet-600" }
                return (
                  <Link key={i} href={a.link} className="flex items-start gap-3 group -mx-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${colors[a.type] || "bg-slate-50 text-slate-600"}`}>{icons[a.type] || <Activity className="size-4" />}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(a.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </Link>
                )
              })}
              {d.activityFeed.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="size-4 text-brand" /><span className="text-xs font-medium text-brand-800">AI Summary</span></div>
              <p className="text-sm text-brand-700 leading-relaxed">
                Circle Pay has <strong>{d.totalUsers}</strong> users across <strong>{d.totalCircles}</strong> circles.
                Today: <strong>{d.todayPayments}</strong> payments generating <strong>R{d.todayRevenue.toLocaleString()}</strong>.
                {d.pendingVerifications > 0 && <span> <strong>{d.pendingVerifications}</strong> circle{d.pendingVerifications !== 1 ? "s" : ""} awaiting verification.</span>}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader><CardContent className="space-y-2">
            <QuickAction href="/owner/users" icon={<Users className="size-4" />} label="Manage Users" />
            <QuickAction href="/owner/verifications" icon={<ShieldCheck className="size-4" />} label="Review Verifications" badge={d.pendingVerifications > 0 ? d.pendingVerifications : undefined} />
            <QuickAction href="/owner/payments" icon={<DollarSign className="size-4" />} label="View Payments" />
            <QuickAction href="/owner/revenue" icon={<TrendingUp className="size-4" />} label="Revenue Report" />
            <QuickAction href="/owner/wallets" icon={<Wallet className="size-4" />} label="Wallet Ledger" />
            <QuickAction href="/owner/audit-logs" icon={<FileText className="size-4" />} label="Audit Logs" />
          </CardContent></Card>
        </div>
      </div>
    </AppPage>
  )
}

function QuickAction({ href, icon, label, badge }: { href: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Button render={<Link href={href} />} variant="outline" className="w-full justify-start gap-2 rounded-xl group">
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge && <Badge className="bg-amber-100 text-amber-700 text-[10px]">{badge}</Badge>}
      <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
    </Button>
  )
}
