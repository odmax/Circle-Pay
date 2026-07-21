import { notFound, redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { ArrowLeft, PiggyBank, TrendingUp, Home, Plane, Target, Heart, Church, Settings, CheckCircle2, SkipForward, RefreshCw, CircleDot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleTypeEngine } from "@/lib/services/circle-type-engine.service"
import { ensureCircleWorkflow } from "@/lib/services/workflow.service"
import { StatCard } from "@/components/ui/app/cards"
import { prisma } from "@/lib/prisma"

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }> = {
  STOKVEL: { icon: PiggyBank, title: "Stokvel Operations", desc: "Monthly collections, payout rotation, and member compliance tracking." },
  INVESTMENT: { icon: TrendingUp, title: "Investment Operations", desc: "Capital pool, asset portfolio, returns, and member ownership shares." },
  HOUSEMATE: { icon: Home, title: "Housemate Operations", desc: "Rent, utilities, groceries, and shared household expenses." },
  TRAVEL: { icon: Plane, title: "Travel Planner", desc: "Trip budget, savings progress, and travel expense tracking." },
  SAVINGS: { icon: Target, title: "Savings Tracker", desc: "Goal-based savings with member contribution tracking." },
  WEDDING: { icon: Heart, title: "Wedding Planner", desc: "Budget, vendor expenses, and savings progress." },
  CHURCH: { icon: Church, title: "Church Finance", desc: "Offerings, tithes, building fund, and ministry expenses." },
  FAMILY: { icon: Home, title: "Family Fund", desc: "Emergency fund, support payouts, and shared family expenses." },
  CUSTOM: { icon: Settings, title: "Circle Overview", desc: "General metrics and activity." },
}

export default async function OperationsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle: Awaited<ReturnType<typeof getCircleById>> | undefined
  let engine: Awaited<ReturnType<typeof getCircleTypeEngine>> | undefined
  let wfData: Awaited<ReturnType<typeof ensureCircleWorkflow>> | undefined
  let pageError: string | null = null
  try {
    ;[circle, engine] = await Promise.all([getCircleById(circleId, session.user.id), getCircleTypeEngine(circleId)])
    wfData = await ensureCircleWorkflow(circleId)
  } catch (e) { pageError = (e as Error).message; console.error("Operations page error:", e) }
  if (pageError) {
    return (<div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Operations</h1></div>
      </div>
      <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="flex items-start gap-3 p-6"><AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" /><div><p className="font-medium text-amber-800">Could not load operations data</p><p className="text-sm text-amber-700 mt-1">{pageError}</p></div></CardContent></Card>
    </div>)
  }
  if (!circle || !wfData || !engine) { return <div>Missing data</div> }
  const meta = TYPE_META[circle.type] || TYPE_META.CUSTOM
  const Icon = meta.icon
  const steps = await prisma.circleWorkflowStep.findMany({ where: { workflowId: wfData.id }, orderBy: { sortOrder: "asc" } })
  const isAdmin = circle.userRole === "OWNER" || circle.userRole === "ADMIN"
  const completed = steps.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED").length
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1></div>
      </div>

      {/* Workflow Progress */}
      <Card className="rounded-2xl border-2 border-brand-100">
        <CardHeader><CardTitle className="text-base flex items-center justify-between"><span className="flex items-center gap-2"><CircleDot className="size-4 text-brand" /> Workflow</span><Badge variant="outline" className={wfData.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "border-brand-200 bg-brand-50 text-brand-700 text-[10px]"}>{wfData.status}</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="text-xs text-muted-foreground">{completed}/{steps.length} steps · {progress}% complete</p>
          <div className="space-y-1">
            {steps.map((step) => {
              const statusColors: Record<string, string> = { COMPLETED: "border-emerald-200 bg-emerald-50", IN_PROGRESS: "border-brand-200 bg-brand-50", BLOCKED: "border-red-200 bg-red-50", SKIPPED: "border-slate-200 bg-slate-50", TODO: "border-border/40" }
              const statusIcons: Record<string, React.ReactNode> = { COMPLETED: <CheckCircle2 className="size-4 text-emerald-600" />, IN_PROGRESS: <div className="size-2 rounded-full bg-brand" />, SKIPPED: <SkipForward className="size-4 text-slate-400" />, TODO: <div className="size-2 rounded-full border-2 border-muted-foreground/30" /> }
              return (
                <div key={step.key} className={`flex items-center gap-3 rounded-xl border p-3 ${statusColors[step.status] || ""}`}>
                  <div className="flex size-7 items-center justify-center shrink-0">{statusIcons[step.status] || <div className="size-2 rounded-full border-2 border-muted-foreground/30" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.status === "TODO" ? "text-muted-foreground" : ""}`}>{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {isAdmin && step.status === "IN_PROGRESS" && (
                    <div className="flex gap-1 shrink-0">
                      <form action={async () => { "use server"; await prisma.circleWorkflowStep.update({ where: { id: step.id }, data: { status: "SKIPPED" } }); const next = await prisma.circleWorkflowStep.findFirst({ where: { workflowId: wfData.id, sortOrder: step.sortOrder + 1 }, orderBy: { sortOrder: "asc" } }); if (next) { await prisma.circleWorkflowStep.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } }); await prisma.circleWorkflow.update({ where: { id: wfData.id }, data: { currentStep: next.key } }) } }}>
                        <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs rounded-lg"><SkipForward className="size-3 mr-1" /> Skip</Button>
                      </form>
                      <form action={async () => { await prisma.circleWorkflowStep.update({ where: { id: step.id }, data: { status: "COMPLETED", completedAt: new Date(), completedById: session.user.id } }); const next = await prisma.circleWorkflowStep.findFirst({ where: { workflowId: wfData.id, sortOrder: step.sortOrder + 1 }, orderBy: { sortOrder: "asc" } }); if (next) { await prisma.circleWorkflowStep.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } }); await prisma.circleWorkflow.update({ where: { id: wfData.id }, data: { currentStep: next.key } }) } else { await prisma.circleWorkflow.update({ where: { id: wfData.id }, data: { status: "COMPLETED" } }) } }}>
                        <Button type="submit" size="sm" className="h-7 text-xs rounded-lg bg-brand hover:bg-brand-600"><CheckCircle2 className="size-3 mr-1" /> Done</Button>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {isAdmin && wfData.status === "COMPLETED" && (
            <form action={async () => { for (const s of steps) { await prisma.circleWorkflowStep.update({ where: { id: s.id }, data: { status: s.sortOrder === 0 ? "IN_PROGRESS" : "TODO", completedAt: null, completedById: null } }) }; await prisma.circleWorkflow.update({ where: { id: wfData.id }, data: { status: "ACTIVE", currentStep: "step_1" } }) }}>
              <Button type="submit" size="sm" variant="outline" className="rounded-xl mt-2"><RefreshCw className="size-3 mr-1" /> Start Next Cycle</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Type Engine Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(engine.primaryMetrics as { label: string; value: string; sub?: string }[]).map((m, i) => <StatCard key={i} label={m.label} value={m.value} sub={m.sub} />)}
      </div>

      {circle.type === "STOKVEL" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Paid This Month</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Member</th><th className="p-3">Amount</th></tr></thead><tbody>{(engine.paidMembers as { name: string; amount: number }[]).map((m, i) => <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{m.name}</td><td className="p-3">R{m.amount.toLocaleString()}</td></tr>)}</tbody></table>{(engine.paidMembers as any[]).length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No payments</p>}</CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Still Owes</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Member</th><th className="p-3">Amount</th></tr></thead><tbody>{(engine.unpaidMembers as { name: string; amount: number }[]).map((m, i) => <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{m.name}</td><td className="p-3 text-amber-600">R{m.amount.toLocaleString()}</td></tr>)}</tbody></table>{(engine.unpaidMembers as any[]).length === 0 && <p className="p-4 text-sm text-emerald-600 text-center">All paid!</p>}</CardContent></Card>
        </div>
      )}

      {circle.type === "INVESTMENT" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Ownership</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Member</th><th className="p-3">Share</th></tr></thead><tbody>{(engine.ownership as { name: string; share: number }[]).map((m, i) => <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{m.name}</td><td className="p-3">{m.share}%</td></tr>)}</tbody></table></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Portfolio</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Asset</th><th className="p-3">Type</th><th className="p-3">Current</th></tr></thead><tbody>{(engine.assets as { name: string; type: string; current: number }[]).map((a, i) => <tr key={i} className="border-b hover:bg-muted/30"><td className="p-3 pl-4">{a.name}</td><td className="p-3"><Badge variant="outline" className="text-[10px]">{a.type}</Badge></td><td className="p-3">R{a.current.toLocaleString()}</td></tr>)}</tbody></table>{(engine.assets as any[]).length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No assets yet</p>}</CardContent></Card>
        </div>
      )}
    </div>
  )
}
