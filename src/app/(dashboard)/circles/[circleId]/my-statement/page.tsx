import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getMemberStatement } from "@/lib/services/member-status.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { CURRENCIES } from "@/lib/constants"

export default async function MyStatementPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let stmt
  try { stmt = await getMemberStatement(circleId, session.user.id) } catch { notFound() }
  const symbol = CURRENCIES.find((c) => c.code === "ZAR")?.symbol || "R"

  const statusBadge = (s: string) => ({ PAID: "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]", PENDING: "border-amber-200 bg-amber-50 text-amber-700 text-[10px]", CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]", PROOF_SUBMITTED: "border-amber-200 bg-emerald-50 text-emerald-700 text-[10px]", REJECTED: "border-red-200 bg-red-50 text-red-700 text-[10px]" }[s] || "text-[10px]")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}/my-status`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">My Statement</h1></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Contributions</CardTitle></CardHeader><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Date</th><th className="p-3">Amount</th><th className="p-3">Status</th></tr></thead>
            <tbody>{stmt.contributions.map((c) => <tr key={c.id} className="border-b hover:bg-muted/30"><td className="p-3 pl-4 text-muted-foreground">{new Date(c.date).toLocaleDateString()}</td><td className="p-3 font-mono">{symbol}{c.amount.toLocaleString()}</td><td className="p-3"><Badge variant="outline" className={statusBadge(c.status)}>{c.status}</Badge></td></tr>)}</tbody>
            {stmt.contributions.length === 0 && <tfoot><tr><td colSpan={3} className="p-4 text-sm text-muted-foreground text-center">No contributions</td></tr></tfoot>}
            <tfoot><tr className="border-t text-xs font-semibold"><td className="p-3 pl-4">Total</td><td className="p-3 font-mono">{symbol}{stmt.totals.contributions.toLocaleString()}</td><td /></tr></tfoot>
          </table>
        </CardContent></Card>

        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Expenses Shared</CardTitle></CardHeader><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Expense</th><th className="p-3">My Share</th></tr></thead>
            <tbody>{stmt.expenses.map((e, i) => <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{e.title}</td><td className="p-3">{symbol}{e.amount.toLocaleString()}</td></tr>)}</tbody>
            {stmt.expenses.length === 0 && <tfoot><tr><td colSpan={2} className="p-4 text-sm text-muted-foreground text-center">No shared expenses</td></tr></tfoot>}
            <tfoot><tr className="border-t text-xs font-semibold"><td className="p-3 pl-4">Total</td><td className="p-3 font-mono">{symbol}{stmt.totals.expensesShared.toLocaleString()}</td></tr></tfoot>
          </table>
        </CardContent></Card>
      </div>

      {/* Balances */}
      {stmt.balances.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Balances</CardTitle></CardHeader><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">With</th><th className="p-3">Amount</th><th className="p-3">Direction</th></tr></thead>
            <tbody>{stmt.balances.map((b) => <tr key={b.id} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{b.direction === "owed" ? b.creditor : b.debtor}</td><td className="p-3 font-mono">{symbol}{b.amount.toLocaleString()}</td><td className="p-3"><Badge variant="outline" className={b.direction === "owed" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"}>{b.direction === "owed" ? "I Owe" : "Owes Me"}</Badge></td></tr>)}</tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  )
}
