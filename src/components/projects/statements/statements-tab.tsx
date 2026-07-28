"use client"

import { useState, useEffect, useCallback } from "react"
import { FileBarChart, FileText, Plus, CheckCircle2, Loader2, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "../types"
import type { CircleData } from "../types"

interface StatementsTabProps { circle: CircleData; circleId: string; projectId: string }
interface Statement { id: string; statementType: string; status: string; periodStart?: string | null; periodEnd?: string | null; totalRevenue: string; totalExpenses: string; netIncome: string; totalAssets: string; totalEquity: string; createdAt: string; breakdown?: any }

const TYPE_LABELS: Record<string, string> = {
  INCOME_STATEMENT: "Income Statement", BALANCE_SHEET: "Balance Sheet", CASH_FLOW: "Cash Flow", PROFIT_LOSS: "Profit & Loss", OWNERSHIP_SUMMARY: "Ownership Summary",
}

export function StatementsTab({ circle, circleId, projectId }: StatementsTabProps) {
  const [statements, setStatements] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [statementType, setStatementType] = useState("INCOME_STATEMENT")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const symbol = circle?.currency || "ZAR"

  const fetchStatements = useCallback(async () => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/financial-statements`)
      if (r.ok) setStatements(await r.json())
    } finally { setLoading(false) }
  }, [circleId, projectId])

  useEffect(() => { fetchStatements() }, [fetchStatements])

  const handleGenerate = async () => {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/financial-statements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementType, periodStart: periodStart || undefined, periodEnd: periodEnd || undefined }),
      })
      if (r.ok) { toast.success("Statement generated"); setShowGenerate(false); fetchStatements() }
      else toast.error((await r.json()).error || "Failed")
    } finally { setSubmitting(false) }
  }

  const handleApprove = async (id: string) => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/financial-statements/${id}`, { method: "PATCH" })
      if (r.ok) { toast.success("Statement approved"); fetchStatements() }
      else toast.error((await r.json()).error || "Failed")
    } catch { toast.error("Failed") }
  }

  if (loading) return <StatementsSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Financial Statements</h2>
        <Button size="sm" className="rounded-xl" onClick={() => setShowGenerate(true)}><Plus className="size-3.5 mr-1" /> Generate Statement</Button>
      </div>

      {statements.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><FileBarChart className="size-8 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No statements generated yet</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {statements.map((s) => (
            <Card key={s.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{TYPE_LABELS[s.statementType] || s.statementType}</span>
                      <Badge className={`text-[10px] ${s.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{s.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {s.periodStart && s.periodEnd && <span>{new Date(s.periodStart).toLocaleDateString()} - {new Date(s.periodEnd).toLocaleDateString()}</span>}
                      <span>Revenue: {formatCurrency(Number(s.totalRevenue), symbol)}</span>
                      <span>Expenses: {formatCurrency(Number(s.totalExpenses), symbol)}</span>
                      <span className="font-medium">Net Income: {formatCurrency(Number(s.netIncome), symbol)}</span>
                      <span>{formatDate(s.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {s.status === "DRAFT" && (
                      <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" onClick={() => handleApprove(s.id)}><CheckCircle2 className="size-3 mr-1" /> Approve</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Generate Statement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Type</Label><Select value={statementType} onValueChange={(v) => setStatementType(v ?? "INCOME_STATEMENT")}><SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Period Start</Label><Input className="rounded-xl h-9" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
              <div><Label className="text-xs">Period End</Label><Input className="rounded-xl h-9" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={handleGenerate} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : "Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatementsSkeleton() {
  return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>)}</div>
}
