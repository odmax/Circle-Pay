import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getMonthlyStatement } from "@/lib/services/report.service"
import { CURRENCIES } from "@/lib/constants"
import { RoleBadge } from "@/components/circles/role-badge"
import type { MemberRole } from "@/generated/prisma"

export default async function MonthlyReportPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, statement
  try { [circle, statement] = await Promise.all([getCircleById(circleId, session.user.id), getMonthlyStatement(circleId, session.user.id)]) }
  catch { notFound() }

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/reports`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{statement.period}</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Contributions</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-emerald-600">{symbol}{statement.contributions.total.toLocaleString()}</div><p className="text-xs text-muted-foreground">{statement.contributions.count} payments</p></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-600">{symbol}{statement.expenses.total.toLocaleString()}</div><p className="text-xs text-muted-foreground">{statement.expenses.count} expenses</p></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Allocations</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-brand">{symbol}{statement.allocations.total.toLocaleString()}</div><p className="text-xs text-muted-foreground">{statement.allocations.count} allocations</p></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Net Activity</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${statement.netActivity >= 0 ? "text-emerald-600" : "text-amber-600"}`}>{statement.netActivity >= 0 ? "+" : ""}{symbol}{statement.netActivity.toLocaleString()}</div></CardContent></Card>
      </div>

      {statement.settlements.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Settlements</CardTitle></CardHeader><CardContent>
          <div className="space-y-1">{statement.settlements.map((s, i) => <div key={i} className="text-sm flex justify-between"><span>Settlement</span><span className="font-mono">{symbol}{s.amount.toLocaleString()}</span></div>)}</div>
        </CardContent></Card>
      )}

      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Member Activity</CardTitle></CardHeader><CardContent>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Member</th><th className="p-2">Role</th><th className="p-2">Contributed</th><th className="p-2">Expense Share</th><th className="p-2">Allocated</th></tr></thead>
          <tbody>{statement.members.map((m) => <tr key={m.userId} className="border-b"><td className="p-2">{m.name}</td><td className="p-2"><RoleBadge role={m.role as MemberRole} /></td><td className="p-2 font-mono">{symbol}{m.contributed.toLocaleString()}</td><td className="p-2 font-mono">{symbol}{m.expenseShare.toLocaleString()}</td><td className="p-2 font-mono">{symbol}{m.allocated.toLocaleString()}</td></tr>)}</tbody>
        </table>
      </CardContent></Card>
    </div>
  )
}
