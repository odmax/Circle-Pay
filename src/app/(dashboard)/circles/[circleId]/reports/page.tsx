import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, PiggyBank, Receipt, Wallet, Target, Users, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getContributionReport, getExpenseReport, getBalanceReport, getGoalReport, getMemberSummaryReport } from "@/lib/services/report.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"
import { CURRENCIES } from "@/lib/constants"

function ReportCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="rounded-2xl border-border/40 hover:border-brand-200 hover:shadow-sm transition-all cursor-pointer h-full">
      <CardContent className="p-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand mb-3">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </CardContent>
    </Card>
  )
}

export default async function ReportsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, contrib, expense, balance, goal, member
  try {
    [circle, contrib, expense, balance, goal, member] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getContributionReport(circleId, session.user.id),
      getExpenseReport(circleId, session.user.id),
      getBalanceReport(circleId, session.user.id),
      getGoalReport(circleId, session.user.id),
      getMemberSummaryReport(circleId, session.user.id),
    ])
  } catch { notFound() }

  if (!await hasFeature(session.user.id, "REPORTS")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency

  const reportCards = [
    { title: "Monthly Statement", desc: "Full month activity summary", icon: Calendar, href: `/circles/${circleId}/reports/monthly` },
    { title: "Contributions", desc: `${symbol}${contrib.total.toLocaleString()} from ${contrib.count} payments`, icon: PiggyBank, onClick: true },
    { title: "Expenses", desc: `${symbol}${expense.total.toLocaleString()} across ${expense.count} expenses`, icon: Receipt, onClick: true },
    { title: "Balances", desc: `${balance.length} outstanding balance${balance.length !== 1 ? "s" : ""}`, icon: Wallet, onClick: true },
    { title: "Goals", desc: `${goal.length} goal${goal.length !== 1 ? "s" : ""} tracked`, icon: Target, onClick: true },
    { title: "Member Summary", desc: `${member.length} member${member.length !== 1 ? "s" : ""} total`, icon: Users, onClick: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((card) => (
          card.href ? (
            <Link key={card.title} href={card.href}>
              <ReportCard icon={<card.icon />} title={card.title} desc={card.desc} />
            </Link>
          ) : (
            <div key={card.title}>
              <ReportCard icon={<card.icon />} title={card.title} desc={card.desc} />
            </div>
          )
        ))}
      </div>

      {/* CSV Downloads */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader><CardTitle className="text-base">Export Data</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button render={<Link href={`/api/circles/${circleId}/reports?type=contributions`} />} variant="outline" size="sm" className="rounded-xl">Contributions CSV</Button>
          <Button render={<Link href={`/api/circles/${circleId}/reports?type=expenses`} />} variant="outline" size="sm" className="rounded-xl">Expenses CSV</Button>
          <Button render={<Link href={`/api/circles/${circleId}/reports?type=balances`} />} variant="outline" size="sm" className="rounded-xl">Balances CSV</Button>
          <Button render={<Link href={`/api/circles/${circleId}/reports?type=members`} />} variant="outline" size="sm" className="rounded-xl">Members CSV</Button>
          <Button variant="outline" size="sm" className="rounded-xl" disabled>Export PDF (soon)</Button>
        </CardContent>
      </Card>
    </div>
  )
}
