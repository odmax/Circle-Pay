import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

const DAY_MS = 24 * 60 * 60 * 1000
function computeDates() { return { thirty: new Date(Date.now() - 30 * DAY_MS), seven: new Date(Date.now() - 7 * DAY_MS) } }

export default async function OwnerModerationPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  await requireOwnerPage(PERMISSIONS.MODERATION_REVIEW)
  const sev = params.severity
  const { thirty, seven } = computeDates()
  const searchParamsObj = new URLSearchParams(params as Record<string, string>)

  const [flagged, deactivated, lowRep, inactive, pendingVerification, _highPending, _noContrib] = await Promise.all([
    prisma.circleModerationReview.count({ where: { status: "OPEN" } }),
    prisma.circle.count({ where: { isActive: false } }),
    prisma.circle.count({ where: { isActive: true, reputation: { score: { lt: 40 } } } }),
    prisma.circle.count({ where: { isActive: true, updatedAt: { lt: thirty } } }),
    prisma.circleVerification.count({ where: { status: "PENDING", submittedAt: { lt: seven } } }),
    prisma.joinRequest.count({ where: { status: "PENDING" } }),
    prisma.circle.count({ where: { isActive: true, contributions: { none: {} } } }),
  ])

  // Risk detection
  const lowRepCircles = await prisma.circle.findMany({
    where: { isActive: true, reputation: { score: { lt: 40 } } },
    include: { _count: { select: { members: true } }, reputation: true, createdBy: { select: { name: true, email: true } }, verification: true },
    take: 30, orderBy: { createdAt: "desc" },
  })

  const risks = lowRepCircles.map((c) => ({
    id: c.id, name: c.name, type: c.type, owner: c.createdBy, members: c._count.members,
    reputation: c.reputation?.score || 0, verification: c.verification?.status || "NONE",
    reason: "Low reputation score",
    severity: c.reputation?.score && c.reputation.score < 20 ? "CRITICAL" as const : c.reputation?.score && c.reputation.score < 30 ? "HIGH" as const : "MEDIUM" as const,
  }))

  if (sev) return null // filtered handled by map below
  const filtered = sev ? risks.filter((r) => r.severity === sev) : risks
  const severityBadge = (s: string) => ({ CRITICAL: "border-red-200 bg-red-50 text-red-700", HIGH: "border-orange-200 bg-orange-50 text-orange-700", MEDIUM: "border-amber-200 bg-amber-50 text-amber-700", LOW: "border-blue-200 bg-blue-50 text-blue-700" }[s] || "")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Moderation Center</h1>
        <p className="text-muted-foreground">{flagged} open reviews · {deactivated} deactivated · {lowRep} low reputation</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{flagged}</div><p className="text-xs text-muted-foreground">Flagged</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-amber-600">{lowRep}</div><p className="text-xs text-muted-foreground">Low Reputation</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{inactive}</div><p className="text-xs text-muted-foreground">Inactive 30+ days</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{pendingVerification}</div><p className="text-xs text-muted-foreground">Pending Verify 7+ days</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ label: "All", value: "" }, { label: "Critical", value: "severity=CRITICAL" }, { label: "High", value: "severity=HIGH" }, { label: "Medium", value: "severity=MEDIUM" }].map((t) => (
          <Link key={t.label} href={`/owner/moderation?${t.value}`}><Badge variant={searchParamsObj.toString() === t.value ? "default" : "outline"} className="cursor-pointer rounded-lg">{t.label}</Badge></Link>
        ))}
      </div>

      <Card className="rounded-2xl"><CardContent className="p-0">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Circle</th><th className="p-3">Owner</th><th className="p-3">Members</th><th className="p-3">Rep</th><th className="p-3">Reason</th><th className="p-3">Severity</th><th className="p-3 pr-4">Actions</th></tr></thead>
          <tbody>{filtered.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              <td className="p-3 pl-4"><Link href={`/owner/circles/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
              <td className="p-3 text-muted-foreground truncate max-w-[100px]">{r.owner?.name || r.owner?.email}</td>
              <td className="p-3">{r.members}</td>
              <td className="p-3">{r.reputation}</td>
              <td className="p-3 text-xs text-muted-foreground">{r.reason}</td>
              <td className="p-3"><Badge variant="outline" className={`text-[10px] ${severityBadge(r.severity)}`}>{r.severity}</Badge></td>
              <td className="p-3 pr-4 flex gap-1">
                <Link href={`/owner/circles/${r.id}`} className="text-brand text-xs hover:underline">Review</Link>
                <Link href={`/owner/circles/${r.id}`} className="text-red-600 text-xs hover:underline">Deactivate</Link>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent></Card>
    </div>
  )
}
