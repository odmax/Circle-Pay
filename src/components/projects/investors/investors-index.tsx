"use client"

import { useEffect, useState } from "react"
import {
  Megaphone, Plus, Upload, CheckCircle2, MessageCircle, ThumbsUp,
  FileText, Calendar, Flag, Sparkles, Lock, Globe, ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatDate } from "@/components/projects/types"
import { ProgressBar } from "@/components/projects/charts"

const UPDATE_TYPES: Record<string, string> = {
  GENERAL: "General", FINANCIAL: "Financial", MILESTONE: "Milestone",
  RISK: "Risk", DISTRIBUTION: "Distribution", DOCUMENT: "Document",
}
const UPDATE_TYPE_COLORS: Record<string, string> = {
  GENERAL: "border-slate-200 bg-slate-50 text-slate-600",
  FINANCIAL: "border-teal-200 bg-teal-50 text-teal-700",
  MILESTONE: "border-brand-200 bg-brand-50 text-brand-700",
  RISK: "border-red-200 bg-red-50 text-red-700",
  DISTRIBUTION: "border-amber-200 bg-amber-50 text-amber-700",
  DOCUMENT: "border-blue-200 bg-blue-50 text-blue-700",
}
const MILESTONE_STATUS_COLORS: Record<string, string> = {
  PLANNED: "border-slate-200 bg-slate-50 text-slate-600",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  AT_RISK: "border-amber-200 bg-amber-50 text-amber-700",
  DELAYED: "border-red-200 bg-red-50 text-red-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-500",
}
const QUESTION_STATUS_COLORS: Record<string, string> = {
  OPEN: "border-amber-200 bg-amber-50 text-amber-700",
  ANSWERED: "border-blue-200 bg-blue-50 text-blue-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
}
const DOC_CATEGORIES: Record<string, string> = {
  AGREEMENT: "Agreements", FINANCIAL_STATEMENT: "Financial statements", REPORT: "Reports",
  RECEIPT: "Receipts", MEETING: "Meeting docs", DISTRIBUTION: "Distribution records", MILESTONE_EVIDENCE: "Milestone evidence", OTHER: "Other",
}

const TABS = [["updates", "Updates"], ["milestones", "Milestones"], ["questions", "Q&A"], ["documents", "Documents"], ["meetings", "Meetings"]] as const

function useInvestorFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(url)
        if (r.ok) {
          const j = await r.json()
          if (!cancelled) setData(j as T)
        }
      } catch { /* keep prior data */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [url, reloadKey])
  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1) }
  return { data, loading, refresh }
}

export function InvestorsIndex({ circleId, projectId }: { circleId: string; projectId: string }) {
  const [tab, setTab] = useState("updates")
  const [isManager, setIsManager] = useState(false)
  const [isInvestor, setIsInvestor] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/dashboard`)
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled) {
          setIsManager(!!d.isManager)
          setIsInvestor(!!d.isInvestor)
        }
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [circleId, projectId])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Investor Relations</h1>
        <p className="text-sm text-muted-foreground">Updates, milestones, Q&A, documents and investor meetings</p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${tab === id ? "bg-brand text-white border-brand" : "bg-background border-border text-muted-foreground hover:border-brand/50 hover:text-brand"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "updates" && <UpdatesSection circleId={circleId} projectId={projectId} isManager={isManager} />}
      {tab === "milestones" && <MilestonesSection circleId={circleId} projectId={projectId} isManager={isManager} />}
      {tab === "questions" && <QuestionsSection circleId={circleId} projectId={projectId} isManager={isManager} isInvestor={isInvestor} />}
      {tab === "documents" && <DocumentsSection circleId={circleId} projectId={projectId} isManager={isManager} />}
      {tab === "meetings" && <MeetingsSection circleId={circleId} projectId={projectId} isManager={isManager} />}
    </div>
  )
}

// ─── Updates ────────────────────────────────────────────────

type UpdateItem = {
  id: string; type: string; title: string; content: string | null; visibility: string; isImportant: boolean;
  publishedAt: string; createdByName: string | null; acknowledged: number; myAcknowledged: boolean;
  attachments: Array<{ id: string; name: string; url: string; mimeType: string | null; size: number }>
}

function UpdatesSection({ circleId, projectId, isManager }: { circleId: string; projectId: string; isManager: boolean }) {
  const { data, loading, refresh } = useInvestorFetch<{ updates: UpdateItem[] }>(`/api/circles/${circleId}/projects/${projectId}/investor/updates`)
  const updates = data?.updates ?? []
  const [showCreate, setShowCreate] = useState(false)
  const [openComment, setOpenComment] = useState<string | null>(null)

  const ack = async (id: string) => {
    await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/updates/${id}?action=acknowledge`, { method: "POST" }).catch(() => {})
    refresh()
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>)}</div>

  return (
    <div className="space-y-3">
      {isManager && (
        <div className="flex justify-end">
          <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> Publish update</Button>
        </div>
      )}
      {updates.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><Megaphone className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No updates yet</p><p className="text-sm text-muted-foreground mt-1">Project updates keep investors informed.</p></CardContent></Card>
      ) : updates.map((u) => (
        <Card key={u.id} className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{u.title}</h3>
                  <Badge variant="outline" className={`text-[10px] ${UPDATE_TYPE_COLORS[u.type] || ""}`}>{UPDATE_TYPES[u.type] || u.type}</Badge>
                  {u.isImportant && <Badge className="text-[10px] bg-amber-500 text-white border-0">Important</Badge>}
                  {u.visibility === "INVESTORS_ONLY" ? <Badge variant="outline" className="text-[10px]"><Lock className="size-3 mr-0.5" /> Investors</Badge> : <Badge variant="outline" className="text-[10px]"><Globe className="size-3 mr-0.5" /> All members</Badge>}
                </div>
                {u.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{u.content}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(u.publishedAt)} · {u.createdByName || "management"}{isManager && u.acknowledged > 0 ? ` · ${u.acknowledged} ack` : ""}</p>
                {u.attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {u.attachments.map((a) => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand underline"><FileText className="size-3" /> {a.name}</a>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant={u.myAcknowledged ? "outline" : "default"} className={`rounded-xl h-8 ${u.myAcknowledged ? "" : "bg-brand hover:bg-brand-600"}`} onClick={() => ack(u.id)}><CheckCircle2 className="size-3.5 mr-1" />{u.myAcknowledged ? "Acknowledged" : "Acknowledge"}</Button>
                <Button size="sm" variant="ghost" className="rounded-xl h-8" onClick={() => setOpenComment(openComment === u.id ? null : u.id)}><MessageCircle className="size-3.5" /></Button>
              </div>
            </div>
            {openComment === u.id && (
              <UpdateCommentBox circleId={circleId} projectId={projectId} updateId={u.id} onDone={refresh} />
            )}
          </CardContent>
        </Card>
      ))}

      {updates.length > 0 && (
        <Button size="sm" variant="ghost" className="rounded-xl" onClick={refresh}><ArrowUpRight className="size-3.5 mr-1" /> Refresh</Button>
      )}

      <CreateUpdateDialog open={showCreate} onOpenChange={setShowCreate} circleId={circleId} projectId={projectId} onCreated={refresh} />
    </div>
  )
}

function UpdateCommentBox({ circleId, projectId, updateId, onDone }: { circleId: string; projectId: string; updateId: string; onDone: () => void }) {
  const [text, setText] = useState("")
  const submit = async (kind: string) => {
    if (!text.trim()) return
    await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/updates/${updateId}?action=${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) })
    setText(""); toast.success(kind === "QUESTION" ? "Question posted" : "Comment posted")
    onDone()
  }
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl" rows={2} placeholder="Comment or ask a question..." />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => submit("comment")}><MessageCircle className="size-3.5 mr-1" /> Comment</Button>
        <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => submit("question")}><Sparkles className="size-3.5 mr-1" /> Question</Button>
      </div>
    </div>
  )
}

function CreateUpdateDialog({ open, onOpenChange, circleId, projectId, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; circleId: string; projectId: string; onCreated: () => void
}) {
  const [form, setForm] = useState<Record<string, string | boolean>>({ type: "GENERAL", title: "", content: "", visibility: "INVESTORS_ONLY" })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!String(form.title).trim()) return toast.error("Title is required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/updates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, title: form.title, content: String(form.content || "") || undefined, visibility: form.visibility, isImportant: !!form.isImportant }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Update published")
      onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Publish project update</DialogTitle><DialogDescription>Investor-only updates are sent only to confirmed investors.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Select value={String(form.type)} onValueChange={(v) => setForm({ ...form, type: v || "GENERAL" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(UPDATE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Visibility"><Select value={String(form.visibility)} onValueChange={(v) => setForm({ ...form, visibility: v || "INVESTORS_ONLY" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INVESTORS_ONLY">Investors only</SelectItem><SelectItem value="ALL_MEMBERS">All members</SelectItem></SelectContent></Select></Field>
          </div>
          <Field label="Title"><Input value={String(form.title || "")} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" /></Field>
          <Field label="Content"><Textarea value={String(form.content || "")} onChange={(e) => setForm({ ...form, content: e.target.value })} className="rounded-xl" rows={4} /></Field>
          <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span className="font-medium">Mark as important</span><input type="checkbox" checked={!!form.isImportant} onChange={(e) => setForm({ ...form, isImportant: e.target.checked })} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Publishing..." : "Publish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Milestones ─────────────────────────────────────────────

type MilestoneItem = { id: string; title: string; description: string | null; targetDate: string | null; status: string; progress: number; budget: number | null; actualCost: number }

function MilestonesSection({ circleId, projectId, isManager }: { circleId: string; projectId: string; isManager: boolean }) {
  const { data, loading, refresh } = useInvestorFetch<{ milestones: MilestoneItem[] }>(`/api/circles/${circleId}/projects/${projectId}/investor/milestones`)
  const ms = data?.milestones ?? []
  const [showCreate, setShowCreate] = useState(false)

  const transition = async (id: string, status: string) => {
    await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/milestones/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    toast.success("Updated"); refresh()
  }

  const avgProgress = ms.length ? Math.round(ms.reduce((s, m) => s + m.progress, 0) / ms.length) : 0
  const done = ms.filter((m) => m.status === "COMPLETED").length

  if (loading) return <Card className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-5 w-full" /></CardContent></Card>

  return (
    <div className="space-y-3">
      {ms.length > 0 && (
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{done}/{ms.length} milestones completed</span><span className="text-muted-foreground">Avg progress {avgProgress}%</span></div>
          <ProgressBar percent={avgProgress} />
        </CardContent></Card>
      )}
      {isManager && <div className="flex justify-end"><Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" /> Add milestone</Button></div>}
      {ms.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><Flag className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No milestones yet</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {ms.map((m) => (
            <Card key={m.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{m.title}</h3>
                      <Badge variant="outline" className={`text-[10px] ${MILESTONE_STATUS_COLORS[m.status] || ""}`}>{m.status.replace(/_/g, " ")}</Badge>
                    </div>
                    {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      {m.targetDate && <span className="flex items-center gap-1"><Calendar className="size-3" /> {formatDate(m.targetDate)}</span>}
                      {m.budget != null && <span>Budget {m.budget.toLocaleString()}</span>}
                      {m.actualCost > 0 && <span>Actual {m.actualCost.toLocaleString()}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold w-10 text-right shrink-0">{m.progress}%</span>
                </div>
                <div className="mt-2"><ProgressBar percent={m.progress} /></div>
                {isManager && m.status !== "COMPLETED" && m.status !== "CANCELLED" && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {m.status === "PLANNED" && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => transition(m.id, "IN_PROGRESS")}>Start</Button>}
                    <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs text-emerald-600" onClick={() => transition(m.id, "COMPLETED")}>Complete</Button>
                    {m.status === "IN_PROGRESS" && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs text-amber-600" onClick={() => transition(m.id, "AT_RISK")}>At risk</Button>}
                    <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs text-red-500" onClick={() => transition(m.id, "DELAYED")}>Delay</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateMilestoneDialog open={showCreate} onOpenChange={setShowCreate} circleId={circleId} projectId={projectId} onCreated={refresh} />
    </div>
  )
}

function CreateMilestoneDialog({ open, onOpenChange, circleId, projectId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; projectId: string; onCreated: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({ title: "", targetDate: "", budget: "" })
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title is required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/milestones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description || undefined, targetDate: form.targetDate || null, budget: form.budget ? Number(form.budget) : undefined }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Milestone added")
      onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add milestone</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" /></Field>
          <Field label="Description"><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl" rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target date"><Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className="rounded-xl" /></Field>
            <Field label="Budget"><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="rounded-xl" /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">Add milestone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Q&A ────────────────────────────────────────────────────

type QuestionItem = { id: string; question: string; visibility: string; status: string; answered: string | null; answerer: string | null; answeredAt: string | null; published: boolean; askerName: string | null; isMine: boolean; createdAt: string }

function QuestionsSection({ circleId, projectId, isManager, isInvestor }: { circleId: string; projectId: string; isManager: boolean; isInvestor: boolean }) {
  const { data, loading, refresh } = useInvestorFetch<{ questions: QuestionItem[] }>(`/api/circles/${circleId}/projects/${projectId}/investor/questions`)
  const qs = data?.questions ?? []
  const [showAsk, setShowAsk] = useState(false)
  const [answeringId, setAnsweringId] = useState<string | null>(null)

  const resolve = async (id: string) => {
    await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/questions/${id}?action=resolve`, { method: "POST" })
    toast.success("Resolved"); refresh()
  }

  if (loading) return <Card className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-5 w-full" /></CardContent></Card>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {isInvestor ? (
          <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowAsk(true)}><Plus className="size-4 mr-1" /> Ask question</Button>
        ) : (
          <p className="text-xs text-muted-foreground">Only invested members can ask questions.</p>
        )}
      </div>
      {qs.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><Sparkles className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No questions yet</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {qs.map((q) => (
            <Card key={q.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{q.question}</p>
                    <div className="flex gap-2 flex-wrap mt-1">
                      <Badge variant="outline" className={`text-[10px] ${QUESTION_STATUS_COLORS[q.status] || ""}`}>{q.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.visibility === "PUBLIC" ? <span className="flex items-center gap-0.5"><Globe className="size-3" /> Public</span> : <span className="flex items-center gap-0.5"><Lock className="size-3" /> Investors</span>}</Badge>
                      {q.published && <Badge variant="outline" className="text-[10px] text-brand">Published</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(q.createdAt)} · {q.askerName || "member"}{q.isMine ? " · you" : ""}</p>
                    {q.answered && (
                      <div className="mt-2 rounded-lg border bg-muted/30 p-2">
                        <p className="text-sm"><span className="font-semibold">Answer ({q.answerer || "management"}):</span> {q.answered}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isManager && q.status === "OPEN" && <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => setAnsweringId(q.id)}>Answer</Button>}
                    {isManager && q.status !== "RESOLVED" && q.answered && <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={() => resolve(q.id)}>Resolve</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AskQuestionDialog open={showAsk} onOpenChange={setShowAsk} circleId={circleId} projectId={projectId} onCreated={refresh} />
      <AnswerQuestionDialog answeringId={answeringId} circleId={circleId} projectId={projectId} onClose={() => setAnsweringId(null)} onDone={() => { refresh(); setAnsweringId(null) }} />
    </div>
  )
}

function AskQuestionDialog({ open, onOpenChange, circleId, projectId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; projectId: string; onCreated: () => void }) {
  const [question, setQuestion] = useState("")
  const [visibility, setVisibility] = useState("INVESTORS_ONLY")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!question.trim()) return toast.error("Enter your question")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, visibility }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Question submitted")
      setQuestion(""); onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Ask the project</DialogTitle><DialogDescription>Questions may be private to investors or public.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Question"><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="rounded-xl" rows={3} /></Field>
          <Field label="Visibility"><Select value={visibility} onValueChange={(v) => setVisibility(v || "INVESTORS_ONLY")}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INVESTORS_ONLY">Investors only</SelectItem><SelectItem value="PUBLIC">Public</SelectItem></SelectContent></Select></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">Ask</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AnswerQuestionDialog({ answeringId, circleId, projectId, onClose, onDone }: { answeringId: string | null; circleId: string; projectId: string; onClose: () => void; onDone: () => void }) {
  const [answer, setAnswer] = useState("")
  const [publish, setPublish] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!answeringId || !answer.trim()) return toast.error("Write an answer")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/questions/${answeringId}?action=answer`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, publishToInvestors: publish }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Answer posted")
      setAnswer(""); onDone()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={!!answeringId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Answer investor question</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Answer"><Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className="rounded-xl" rows={3} /></Field>
          <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span className="font-medium">Publish answer to all investors</span><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">Post answer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Documents ──────────────────────────────────────────────

type DocItem = { id: string; category: string; name: string; description: string | null; url: string; mimeType: string | null; size: number; visibility: string; milestoneId: string | null; uploadedByName: string | null; createdAt: string }

function DocumentsSection({ circleId, projectId, isManager }: { circleId: string; projectId: string; isManager: boolean }) {
  const { data, loading, refresh } = useInvestorFetch<{ documents: DocItem[] }>(`/api/circles/${circleId}/projects/${projectId}/investor/documents`)
  const docs = data?.documents ?? []
  const [showUpload, setShowUpload] = useState(false)

  const grouped = Object.keys(DOC_CATEGORIES).map((cat) => ({ cat, items: docs.filter((d) => d.category === cat) }))

  if (loading) return <Card className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-5 w-full" /></CardContent></Card>

  return (
    <div className="space-y-3">
      {isManager && <div className="flex justify-end"><Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowUpload(true)}><Upload className="size-4 mr-1" /> Upload document</Button></div>}
      {docs.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><FileText className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No documents yet</p></CardContent></Card>
      ) : grouped.map(({ cat, items }) => items.length === 0 ? null : (
        <Card key={cat} className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{DOC_CATEGORIES[cat]}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {items.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm rounded-lg border px-3 py-2 hover:bg-muted/40 transition-colors">
                <span className="flex items-center gap-2 min-w-0 truncate"><FileText className="size-4 text-brand shrink-0" /><span className="truncate">{d.name}</span></span>
                <span className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground">
                  {d.visibility === "INVESTORS_ONLY" ? <Lock className="size-3" /> : <Globe className="size-3" />}
                  {d.size ? `${(d.size / 1024).toFixed(0)}KB` : ""} · <ArrowUpRight className="size-3" />
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      ))}
      <UploadDocumentDialog open={showUpload} onOpenChange={setShowUpload} circleId={circleId} projectId={projectId} onCreated={refresh} />
    </div>
  )
}

function UploadDocumentDialog({ open, onOpenChange, circleId, projectId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; projectId: string; onCreated: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("REPORT")
  const [visibility, setVisibility] = useState("INVESTORS_ONLY")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!file) return toast.error("Choose a file")
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (name.trim()) fd.append("name", name.trim())
      fd.append("category", category)
      fd.append("visibility", visibility)
      if (description.trim()) fd.append("description", description.trim())
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/documents`, { method: "POST", body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Document published")
      setFile(null); setName(""); onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Publish investor document</DialogTitle><DialogDescription>Stored securely in private project storage.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="File"><label className="flex items-center gap-3 rounded-xl border border-dashed p-3 cursor-pointer hover:bg-muted/40 transition-colors"><span className="size-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0"><Upload className="size-4 text-brand" /></span><span className="flex-1 min-w-0 text-sm font-medium truncate">{file ? file.name : "Choose file (JPG, PNG, WebP, PDF · max 5MB)"}</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></Field>
          <Field label="Name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Select value={category} onValueChange={(v) => setCategory(v || "REPORT")}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DOC_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Visibility"><Select value={visibility} onValueChange={(v) => setVisibility(v || "INVESTORS_ONLY")}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INVESTORS_ONLY">Investors only</SelectItem><SelectItem value="ALL_MEMBERS">All members</SelectItem></SelectContent></Select></Field>
          </div>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">{submitting ? "Uploading..." : "Publish document"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Meetings ────────────────────────────────────────────────

type MeetingItem = { id: string; title: string; description: string | null; scheduledAt: string; status: string; isOnline: boolean; meetingLink: string | null }

function MeetingsSection({ circleId, projectId, isManager }: { circleId: string; projectId: string; isManager: boolean }) {
  const { data, loading, refresh } = useInvestorFetch<{ meetings: MeetingItem[] }>(`/api/circles/${circleId}/projects/${projectId}/investor/meetings`)
  const meetings = data?.meetings ?? []
  const [showSchedule, setShowSchedule] = useState(false)

  if (loading) return <Card className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-5 w-full" /></CardContent></Card>

  return (
    <div className="space-y-3">
      {isManager && <div className="flex justify-end"><Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={() => setShowSchedule(true)}><Plus className="size-4 mr-1" /> Schedule investor meeting</Button></div>}
      {meetings.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-12 text-center"><Calendar className="size-10 text-muted-foreground/30 mx-auto mb-3" /><p className="font-medium">No project meetings scheduled</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <Card key={m.id} className="rounded-2xl"><CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(m.scheduledAt)}{m.isOnline ? " · Online" : ""} · {m.status.replace(/_/g, " ")}</p>
                {m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noreferrer" className="text-xs text-brand underline mt-1 inline-block">Join link</a>}
              </div>
              <ThumbsUp className="size-4 text-muted-foreground shrink-0" />
            </CardContent></Card>
          ))}
        </div>
      )}
      <ScheduleMeetingDialog open={showSchedule} onOpenChange={setShowSchedule} circleId={circleId} projectId={projectId} onCreated={refresh} />
    </div>
  )
}

function ScheduleMeetingDialog({ open, onOpenChange, circleId, projectId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; circleId: string; projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!title.trim() || !scheduledAt) return toast.error("Title and time are required")
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/investor/meetings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, scheduledAt: new Date(scheduledAt).toISOString() }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed")
      toast.success("Investor meeting scheduled")
      setTitle(""); onOpenChange(false); onCreated()
    } catch (e) { toast.error((e as Error).message) } finally { setSubmitting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Schedule investor meeting</DialogTitle><DialogDescription>Investors are notified. The meeting also appears on your project overview.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" /></Field>
          <Field label="Date & time"><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="rounded-xl" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
}