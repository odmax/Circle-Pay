import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { AlertTriangle } from "lucide-react"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

const DAY_MS = 24 * 60 * 60 * 1000
function computeDates() { return { week: new Date(Date.now() - 7 * DAY_MS), sixtyDays: new Date(Date.now() - 60 * DAY_MS) } }

export default async function OwnerFraudPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  await requireOwnerPage(PERMISSIONS.FRAUD_REVIEW)
  const sev = params.severity
  const { week, sixtyDays } = computeDates()
  const searchParamsObj = new URLSearchParams(params as Record<string, string>)

  let signals: { id: string; type: string; severity: string; target: string; link: string; detail: string }[] = []
  let openReports = 0, failedPayments = 0, manyPendingJoins = 0, lowRepCirclesCount = 0
  try {
    // Risk detection
    const [openReportsVal, lowRepCircles, _rapidGrowth, manyPendingJoinsVal, largeWallet, failedPaymentsVal, inactivePublic] = await Promise.all([
      prisma.abuseReport.count({ where: { status: "OPEN" } }),
      prisma.circle.findMany({ where: { isActive: true, reputation: { score: { lt: 30 } } }, include: { _count: { select: { members: true } }, reputation: true, createdBy: { select: { name: true, email: true } } }, take: 30, orderBy: { createdAt: "desc" } }),
      prisma.circle.findMany({ where: { isActive: true, members: { some: { joinedAt: { gte: week } } } }, include: { _count: { select: { members: true } }, reputation: true, createdBy: { select: { name: true, email: true } } }, take: 20 }),
      prisma.joinRequest.count({ where: { status: "PENDING" } }),
      prisma.ledgerTransaction.findMany({ where: { status: "CONFIRMED" }, include: { circle: { select: { id: true, name: true } } }, orderBy: { amount: "desc" }, take: 10 }),
      prisma.paymentTransaction.count({ where: { status: "FAILED" } }),
      prisma.circle.findMany({ where: { visibility: "PUBLIC", isActive: true, updatedAt: { lt: sixtyDays } }, include: { _count: { select: { members: true } }, createdBy: { select: { name: true } } }, take: 20 }),
    ])
    openReports = openReportsVal; manyPendingJoins = manyPendingJoinsVal; failedPayments = failedPaymentsVal; lowRepCirclesCount = lowRepCircles.length

    for (const c of lowRepCircles.slice(0, 10)) {
      const score = c.reputation?.score || 0
      signals.push({ id: c.id, type: "LOW_REPUTATION", severity: score < 20 ? "CRITICAL" : score < 25 ? "HIGH" : "MEDIUM", target: c.name, link: `/owner/circles/${c.id}`, detail: `Reputation: ${score}. ${c._count.members} members. Owner: ${c.createdBy?.name || c.createdBy?.email}` })
    }
    for (const i of inactivePublic.slice(0, 5)) {
      signals.push({ id: i.id, type: "INACTIVE_PUBLIC_CIRCLE", severity: "LOW", target: i.name, link: `/owner/circles/${i.id}`, detail: `Inactive 60+ days. ${i._count.members} members.` })
    }
    for (const t of largeWallet.slice(0, 5)) {
      if (Number(t.amount) > 50000) {
        signals.push({ id: t.id, type: "LARGE_WALLET_MOVEMENT", severity: "MEDIUM", target: t.circle?.name || "Unknown", link: `/owner/wallets`, detail: `Transaction: R${Number(t.amount).toLocaleString()}` })
      }
    }
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Fraud & Abuse Center</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Unable to load fraud data</h2><p className="text-sm text-muted-foreground mt-1">The fraud detection data could not be retrieved.</p></div>
          <a href="/owner/fraud" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/fraud", itemCount: signals.length })

  const filtered = sev ? signals.filter((s) => s.severity === sev) : signals
  const severityBadge = (s: string) => ({ CRITICAL: "border-red-200 bg-red-50 text-red-700", HIGH: "border-orange-200 bg-orange-50 text-orange-700", MEDIUM: "border-amber-200 bg-amber-50 text-amber-700", LOW: "border-blue-200 bg-blue-50 text-blue-700" }[s] || "")

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Fraud & Abuse Center</h1><p className="text-muted-foreground">{openReports} open reports · {signals.length} risk signals · {failedPayments} failed payments</p></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{openReports}</div><p className="text-xs text-muted-foreground">Open Reports</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-amber-600">{lowRepCirclesCount}</div><p className="text-xs text-muted-foreground">Low Rep Circles</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{manyPendingJoins}</div><p className="text-xs text-muted-foreground">Pending Joins</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-500">{failedPayments}</div><p className="text-xs text-muted-foreground">Failed Payments</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ label: "All", value: "" }, { label: "Critical", value: "severity=CRITICAL" }, { label: "High", value: "severity=HIGH" }, { label: "Medium", value: "severity=MEDIUM" }].map((t) => (
          <Link key={t.label} href={`/owner/fraud?${t.value}`}><Badge variant={searchParamsObj.toString() === t.value ? "default" : "outline"} className="cursor-pointer rounded-lg">{t.label}</Badge></Link>
        ))}
      </div>

      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Risk Signals ({filtered.length})</CardTitle></CardHeader><CardContent className="p-0">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Target</th><th className="p-3">Signal</th><th className="p-3">Severity</th><th className="p-3">Detail</th><th className="p-3 pr-4">Actions</th></tr></thead>
          <tbody>{filtered.slice(0, 30).map((s, i) => (
            <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4 font-medium">{s.target}</td><td className="p-3"><Badge variant="outline" className="text-[10px]">{s.type.replace(/_/g, " ")}</Badge></td><td className="p-3"><Badge variant="outline" className={`text-[10px] ${severityBadge(s.severity)}`}>{s.severity}</Badge></td><td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{s.detail}</td><td className="p-3 pr-4"><Link href={s.link} className="text-brand text-xs hover:underline">View</Link></td></tr>
          ))}</tbody>
        </table>
      </CardContent></Card>
    </div>
  )
}
