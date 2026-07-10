"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FolderKanban, TrendingUp, Calendar, User, Clock, Plus, Power, PowerOff, Upload, CheckCircle2, XCircle, Loader2, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

const statusBadge = (s: string) => ({ DRAFT: "border-slate-200 bg-slate-50 text-slate-600", FUNDING: "border-amber-200 bg-amber-50 text-amber-700", FUNDED: "border-blue-200 bg-blue-50 text-blue-700", IN_PROGRESS: "border-brand-200 bg-brand-50 text-brand-700", COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700", OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700", CLOSED: "border-slate-200 bg-slate-50 text-slate-600", PENDING: "border-slate-200 bg-slate-50 text-slate-600", PROOF_SUBMITTED: "border-amber-200 bg-amber-50 text-amber-700", CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700", REJECTED: "border-red-200 bg-red-50 text-red-700" }[s] || "")

export default function ProjectDetailPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const [tab, setTab] = useState("overview")
  const [project, setProject] = useState<any>(null)
  const [funding, setFunding] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<any>(null)
  const [roiData, setRoiData] = useState<any>(null)
  const [distData, setDistData] = useState<any>(null)
  const [newRound, setNewRound] = useState({ name: "", targetAmount: "" })
  const [newContrib, setNewContrib] = useState({ amount: "", reference: "" })
  const [newExpense, setNewExpense] = useState({ title: "", amount: "", category: "OTHER" })
  const [newAsset, setNewAsset] = useState({ name: "", purchaseAmount: "" })
  const [newRevenue, setNewRevenue] = useState({ amount: "", description: "" })
  const [creatingRound, setCreatingRound] = useState(false)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      fetch(`/api/circles/${circleId}/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/circles/${circleId}/projects/${projectId}/funding-rounds`).then((r) => r.json()),
      fetch(`/api/circles/${circleId}/projects/${projectId}/expenses`).then((r) => r.json()),
      fetch(`/api/circles/${circleId}/projects/${projectId}/roi`).then((r) => r.json()),
      fetch(`/api/circles/${circleId}/projects/${projectId}/distributions`).then((r) => r.json()),
    ]).then(([p, f, e, rd, dd]) => { setProject(p); setFunding(f); setExpenses(e); setRoiData(rd); setDistData(dd) }).finally(() => setLoading(false))
  }, [circleId, projectId])

  async function fundingAction(act: string, roundId?: string) {
    const url = roundId ? `/api/circles/${circleId}/projects/${projectId}/funding-rounds/${roundId}/${act}` : `/api/circles/${circleId}/projects/${projectId}/funding-rounds`
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: act === "create" ? JSON.stringify({ name: newRound.name, targetAmount: Number(newRound.targetAmount) }) : undefined })
    if (!r.ok) { toast.error("Failed") }
    else { toast.success("Done"); setNewRound({ name: "", targetAmount: "" }); setCreatingRound(false); router.refresh() }
  }

  async function contribAction(act: string, contribId?: string) {
    const url = contribId ? `/api/circles/${circleId}/projects/${projectId}/contributions/${contribId}/${act}` : `/api/circles/${circleId}/projects/${projectId}/contributions`
    const body = act === "create" ? { amount: Number(newContrib.amount), reference: newContrib.reference } : act === "proof" ? { reference: prompt("Reference/note:") || "" } : act === "reject" ? { reason: prompt("Rejection reason:") || "" } : undefined
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    if (!r.ok) { toast.error("Failed") }
    else { toast.success("Done"); setNewContrib({ amount: "", reference: "" }); router.refresh() }
  }

  async function expenseAction(act: string, expenseId?: string) {
    const url = expenseId ? `/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}/${act}` : `/api/circles/${circleId}/projects/${projectId}/expenses`
    const body = act === "create" ? { title: newExpense.title, amount: Number(newExpense.amount), category: newExpense.category } : act === "reject" ? { reason: prompt("Reason:") || "" } : undefined
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    if (!r.ok) { toast.error("Failed") }
    else { toast.success("Done"); setNewExpense({ title: "", amount: "", category: "OTHER" }); router.refresh() }
  }

  async function assetAction(act: string, assetId?: string) {
    const url = assetId ? `/api/circles/${circleId}/projects/${projectId}/assets/${assetId}/${act}` : `/api/circles/${circleId}/projects/${projectId}/assets`
    const body = act === "create" ? { name: newAsset.name, purchaseAmount: Number(newAsset.purchaseAmount) || undefined } : act === "sold" ? { saleValue: Number(prompt("Sale value:") || "0") } : undefined
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    if (!r.ok) { toast.error("Failed") }
    else { toast.success("Done"); setNewAsset({ name: "", purchaseAmount: "" }); router.refresh() }
  }

  async function revenueAction(act: string) {
    const url = `/api/circles/${circleId}/projects/${projectId}/revenue`
    const body = { amount: Number(newRevenue.amount), description: newRevenue.description }
    if (act === "create") { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) { toast.error("Failed") } else { toast.success("Done"); setNewRevenue({ amount: "", description: "" }); router.refresh() } }
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="size-4 animate-spin" /></div>
  if (!project || !project.id) return <div className="p-8 text-muted-foreground">Project not found</div>

  const symbol = "R"
  const progress = project.targetAmount && Number(project.targetAmount) > 0 ? Math.round((Number(project.currentAmount) / Number(project.targetAmount)) * 100) : 0
  const rounds = funding?.rounds || []
  const contributions = funding?.contributions || []
  const summary = funding?.summary || { raised: 0, totalTarget: 0 }
  const expSummary = expenses?.summary || { raised: 0, totalPaid: 0, totalApproved: 0, totalPending: 0, remainingBudget: 0, spendPercentage: 0 }
  const expList = expenses?.expenses || []
  const roi = roiData?.summary || {}
  const assets = roiData?.assets || []
  const revenues = roiData?.revenues || []
  const ownership = distData?.ownership || { total: 0, owners: [] }
  const distributions = distData?.distributions || []

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: circleId, href: `/circles/${circleId}` }, { label: "Projects", href: `/circles/${circleId}/projects` }, { label: project.name }]} />
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}/projects`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">{project.name}</h1><Badge variant="outline" className={`ml-2 ${statusBadge(project.status)}`}>{project.status?.replace(/_/g, " ")}</Badge></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0 overflow-x-auto">
        {["overview", "funding", "contributions", "expenses", "assets", "revenue", "roi", "ownership", "distributions", "timeline"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${tab === t ? "border-b-2 border-brand text-brand" : "text-muted-foreground hover:text-foreground"}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Status" value={project.status?.replace(/_/g, " ")} icon={<FolderKanban className="size-4" />} />
            <Stat label="Target" value={project.targetAmount ? `${symbol}${Number(project.targetAmount).toLocaleString()}` : "—"} icon={<TrendingUp className="size-4" />} />
            <Stat label="Raised" value={`${symbol}${Number(project.currentAmount).toLocaleString()}`} icon={<TrendingUp className="size-4" />} />
            <Stat label="Created" value={new Date(project.createdAt).toLocaleDateString()} icon={<Calendar className="size-4" />} />
          </div>
          {project.targetAmount && (
            <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex justify-between text-sm mb-2"><span>{symbol}{Number(project.currentAmount).toLocaleString()}</span><span className="text-muted-foreground">{symbol}{Number(project.targetAmount).toLocaleString()}</span></div><div className="h-3 rounded-full bg-muted overflow-hidden"><div className="h-3 rounded-full bg-brand" style={{ width: `${Math.min(progress, 100)}%` }} /></div><p className="text-xs text-muted-foreground mt-2">{progress}% funded</p></CardContent></Card>
          )}
          <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm">{project.description || "No description"}</p></CardContent></Card>
        </div>
      )}

      {tab === "funding" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Raised" value={`${symbol}${summary.raised.toLocaleString()}`} />
            <Stat label="Target" value={`${symbol}${summary.totalTarget.toLocaleString()}`} />
            <Stat label="Pending Proofs" value={String(summary.pendingCount)} />
          </div>
          <div className="flex gap-2 items-center">
            <Input value={newRound.name} onChange={(e) => setNewRound({ ...newRound, name: e.target.value })} placeholder="Round name" className="rounded-xl flex-1" />
            <Input value={newRound.targetAmount} onChange={(e) => setNewRound({ ...newRound, targetAmount: e.target.value })} placeholder="Target (R)" type="number" className="rounded-xl w-32" />
            <Button onClick={() => fundingAction("create")} disabled={!newRound.name || !newRound.targetAmount} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button>
          </div>
          <div className="space-y-2">
            {rounds.map((r: any) => (
              <Card key={r.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4">
                <div className="flex-1"><p className="font-medium">{r.name}</p><div className="flex gap-1.5 mt-0.5"><Badge variant="outline" className={`text-[10px] ${statusBadge(r.status)}`}>{r.status}</Badge><span className="text-xs text-muted-foreground">{symbol}{Number(r.currentAmount).toLocaleString()} / {symbol}{Number(r.targetAmount).toLocaleString()}</span></div></div>
                <div className="flex gap-1">
                  {r.status === "DRAFT" && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => fundingAction("open", r.id)}><Power className="size-3 mr-1" /> Open</Button>}
                  {r.status === "OPEN" && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => fundingAction("close", r.id)}><PowerOff className="size-3 mr-1" /> Close</Button>}
                </div>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}

      {tab === "contributions" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={newContrib.amount} onChange={(e) => setNewContrib({ ...newContrib, amount: e.target.value })} placeholder="Amount (R)" type="number" className="rounded-xl w-32" />
            <Input value={newContrib.reference} onChange={(e) => setNewContrib({ ...newContrib, reference: e.target.value })} placeholder="Reference" className="rounded-xl flex-1" />
            <Button onClick={() => contribAction("create")} disabled={!newContrib.amount} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button>
          </div>
          <div className="space-y-2">
            {contributions.map((c: any) => (
              <Card key={c.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4">
                <div className="flex-1"><p className="font-medium">{c.user?.name || c.user?.email}</p><div className="flex gap-1.5 mt-0.5"><Badge variant="outline" className={`text-[10px] ${statusBadge(c.status)}`}>{c.status.replace(/_/g, " ")}</Badge><span className="text-xs">{symbol}{Number(c.amount).toLocaleString()}</span></div></div>
                <div className="flex gap-1">
                  {(c.status === "PENDING" || c.status === "REJECTED") && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => contribAction("proof", c.id)}><Upload className="size-3 mr-1" /> Proof</Button>}
                  {c.status === "PROOF_SUBMITTED" && <><Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => contribAction("confirm", c.id)}><CheckCircle2 className="size-3" /></Button><Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => contribAction("reject", c.id)}><XCircle className="size-3" /></Button></>}
                </div>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Raised" value={`${symbol}${(expSummary.raised || 0).toLocaleString()}`} />
            <Stat label="Spent" value={`${symbol}${(expSummary.totalPaid || 0).toLocaleString()}`} />
            <Stat label="Remaining" value={`${symbol}${(expSummary.remainingBudget || 0).toLocaleString()}`} />
            <Stat label="Spend %" value={`${expSummary.spendPercentage || 0}%`} />
          </div>
          <div className="flex gap-2">
            <Input value={newExpense.title} onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })} placeholder="Expense title" className="rounded-xl flex-1" />
            <Input value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} placeholder="Amount (R)" type="number" className="rounded-xl w-28" />
            <select value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} className="rounded-xl border px-2 text-sm"><option value="OTHER">Other</option><option value="LEGAL">Legal</option><option value="LABOUR">Labour</option><option value="MATERIALS">Materials</option><option value="TRANSPORT">Transport</option><option value="ADMIN">Admin</option><option value="MARKETING">Marketing</option></select>
            <Button onClick={() => expenseAction("create")} disabled={!newExpense.title || !newExpense.amount} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button>
          </div>
          <div className="space-y-2">{(expList as any[])?.map((e: any) => (
            <Card key={e.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4">
              <div className="flex-1"><p className="font-medium">{e.title}</p><div className="flex gap-1.5 mt-0.5"><Badge variant="outline" className={`text-[10px] ${statusBadge(e.status)}`}>{e.status.replace(/_/g, " ")}</Badge><Badge variant="outline" className="text-[10px]">{e.category}</Badge><span className="text-xs">{symbol}{Number(e.amount).toLocaleString()}</span></div></div>
              <div className="flex gap-1">
                {(e.status === "DRAFT" || e.status === "PENDING") && <><Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => expenseAction("approve", e.id)}><CheckCircle2 className="size-3" /></Button><Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => expenseAction("cancel", e.id)}><XCircle className="size-3" /></Button></>}
                {e.status === "APPROVED" && <Button variant="ghost" size="sm" className="h-7 text-xs text-brand" onClick={() => expenseAction("paid", e.id)}>Mark Paid</Button>}
              </div>
            </CardContent></Card>
          ))}</div>
        </div>
      )}

      {tab === "assets" && (
        <div className="space-y-4">
          <div className="flex gap-2"><Input value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="Asset name" className="rounded-xl flex-1" /><Input value={newAsset.purchaseAmount} onChange={(e) => setNewAsset({ ...newAsset, purchaseAmount: e.target.value })} placeholder="Purchase (R)" type="number" className="rounded-xl w-32" /><Button onClick={() => assetAction("create")} disabled={!newAsset.name} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button></div>
          <div className="space-y-2">{assets.map((a: any) => (
            <Card key={a.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4">
              <div className="flex-1"><p className="font-medium">{a.name}</p><div className="flex gap-1.5 mt-0.5"><Badge variant="outline" className={`text-[10px] ${statusBadge(a.status)}`}>{a.status}</Badge><Badge variant="outline" className="text-[10px]">{a.type}</Badge>{a.purchaseAmount && <span className="text-xs">{symbol}{a.purchaseAmount.toLocaleString()}</span>}</div></div>
              <div className="flex gap-1">
                {(a.status === "PURCHASED" || a.status === "ACTIVE") && <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => assetAction("sold", a.id)}>Mark Sold</Button>}
              </div>
            </CardContent></Card>
          ))}</div>
        </div>
      )}

      {tab === "revenue" && (
        <div className="space-y-4">
          <div className="flex gap-2"><Input value={newRevenue.amount} onChange={(e) => setNewRevenue({ ...newRevenue, amount: e.target.value })} placeholder="Amount (R)" type="number" className="rounded-xl w-32" /><Input value={newRevenue.description} onChange={(e) => setNewRevenue({ ...newRevenue, description: e.target.value })} placeholder="Description" className="rounded-xl flex-1" /><Button onClick={() => revenueAction("create")} disabled={!newRevenue.amount} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button></div>
          <div className="space-y-2">{revenues.map((r: any) => (
            <Card key={r.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4">
              <div className="flex-1"><p className="font-medium">{r.description || "Revenue"}</p><div className="flex gap-1.5 mt-0.5"><Badge variant="outline" className="text-[10px]">{r.type}</Badge>{r.asset && <Badge variant="outline" className="text-[10px]">{r.asset}</Badge>}<span className="text-xs text-emerald-600">+{symbol}{r.amount.toLocaleString()}</span></div></div>
              <span className="text-xs text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString() : ""}</span>
            </CardContent></Card>
          ))}</div>
        </div>
      )}

      {tab === "roi" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Raised" value={`${symbol}${(roi.raised || 0).toLocaleString()}`} />
            <Stat label="Paid Expenses" value={`${symbol}${(roi.totalExpensesPaid || 0).toLocaleString()}`} />
            <Stat label="Asset Value" value={`${symbol}${(roi.totalCurrentAssetValue || 0).toLocaleString()}`} />
            <Stat label="Revenue" value={`${symbol}${(roi.totalRevenue || 0).toLocaleString()}`} />
          </div>
          <Card className="rounded-2xl"><CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span className="text-sm">Net Profit</span><span className={`font-bold ${(roi.netProfit || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{symbol}{(roi.netProfit || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-sm">ROI</span><span className={`font-bold ${(roi.roi || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{roi.roi || 0}%</span></div>
            <div className="flex justify-between"><span className="text-sm">Gross Profit</span><span>{symbol}{(roi.grossProfit || 0).toLocaleString()}</span></div>
          </CardContent></Card>
        </div>
      )}

      {tab === "ownership" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Total confirmed capital: <strong>{symbol}{ownership.total.toLocaleString()}</strong></p>
          <div className="space-y-2">{ownership.owners.map((o: any) => (
            <Card key={o.id} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4">
              <div className="flex-1"><p className="font-medium">{o.name || o.email}</p><div className="flex gap-2 mt-0.5"><span className="text-xs text-muted-foreground">{symbol}{o.contribution.toLocaleString()}</span></div></div>
              <div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-muted overflow-hidden"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(o.ownership, 100)}%` }} /></div><span className="text-sm font-bold w-12 text-right">{o.ownership}%</span></div>
            </CardContent></Card>
          ))}</div>
        </div>
      )}

      {tab === "distributions" && (
        <div className="space-y-4">
          <form onSubmit={async (e) => { e.preventDefault(); const name = (e.target as any).name.value; if (name) { const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/distributions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); if (!r.ok) toast.error("Failed to create"); else { toast.success("Created"); router.refresh() } } }}>
            <div className="flex gap-2"><input name="name" placeholder="Distribution name" className="rounded-xl border px-3 py-1.5 text-sm flex-1" /><Button type="submit" className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4" /></Button></div>
          </form>
          <div className="space-y-2">{distributions.map((d: any) => (
            <Card key={d.id} className="rounded-2xl"><CardHeader><CardTitle className="text-base flex items-center justify-between"><span>{d.name}</span><Badge variant="outline" className={`text-[10px] ${statusBadge(d.status)}`}>{d.status.replace(/_/g, " ")}</Badge></CardTitle></CardHeader><CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Profit: {symbol}{Number(d.totalProfit).toLocaleString()} · {d.items?.length || 0} recipients</p>
              <div className="space-y-1">{d.items?.map((i: any) => (
                <div key={i.id} className="flex justify-between text-sm"><span>{i.user?.name || i.user?.email}</span><span className="font-mono">{symbol}{Number(i.profitShare).toLocaleString()} ({Number(i.ownershipPercentage)}%)</span></div>
              ))}</div>
              {(d.status === "DRAFT" || d.status === "PENDING_APPROVAL") && (
                <Button size="sm" className="rounded-xl bg-brand hover:bg-brand-600" onClick={async () => { const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/distributions/${d.id}/approve`, { method: "POST" }); if (!r.ok) toast.error("Failed"); else { toast.success("Approved"); router.refresh() } }}>Approve</Button>
              )}
            </CardContent></Card>
          ))}</div>
        </div>
      )}

      {tab === "timeline" && (
        <Card className="rounded-2xl"><CardContent className="p-4">
          {project.activities?.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p> : (
            <div className="space-y-3">{(project.activities as any[])?.map((a: any) => (
              <div key={a.id} className="flex gap-3 text-sm"><div className="flex flex-col items-center"><div className="size-2 rounded-full bg-muted-foreground/30 mt-1.5" /><div className="w-px flex-1 bg-border" /></div><div className="flex-1 pb-2"><p className="font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.description}</p><p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleString()}</p></div></div>
            ))}</div>
          )}
        </CardContent></Card>
      )}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold mt-0.5">{value}</p></div>{icon}</div></CardContent></Card>
}
