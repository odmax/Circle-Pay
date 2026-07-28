"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { AlertTriangle, Shield, HandHelping, ArrowRightLeft, Gift, CheckCircle2, XCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "../types"
import type { ShortfallData, CircleData } from "../types"

interface ShortfallTabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

const COVER_TYPES = [
  { value: "COVER_ADVANCE", label: "Cover Advance", icon: Shield, desc: "Advance payment that may be repaid" },
  { value: "OWNERSHIP_TRANSFER", label: "Ownership Transfer", icon: ArrowRightLeft, desc: "Transfer ownership to cover shortfall (requires approval)" },
  { value: "PROJECT_ADVANCE", label: "Project Advance", icon: HandHelping, desc: "Repayable advance to the project" },
  { value: "DONATION", label: "Donation", icon: Gift, desc: "Donation with no repayment expectation" },
]

export function ShortfallTab({ circle, circleId, projectId }: ShortfallTabProps) {
  const [shortfalls, setShortfalls] = useState<ShortfallData[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCoverDialog, setShowCoverDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [coverForm, setCoverForm] = useState({ amount: "", type: "COVER_ADVANCE", coveringParticipantId: "", coveredParticipantId: "", notes: "" })

  const symbol = circle?.currency || "ZAR"

  const fetchShortfalls = useCallback(async () => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/shortfall`)
      if (r.ok) {
        const data = await r.json()
        setShortfalls(data.shortfalls || data || [])
        setSummary(data.summary || null)
      }
    } finally {
      setLoading(false)
    }
  }, [circleId, projectId])

  useEffect(() => { fetchShortfalls() }, [fetchShortfalls])

  const submitCover = useCallback(async () => {
    if (!coverForm.amount) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/shortfall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(coverForm.amount),
          type: coverForm.type,
          coveringParticipantId: coverForm.coveringParticipantId || undefined,
          coveredParticipantId: coverForm.coveredParticipantId || undefined,
        }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Shortfall cover submitted")
      setShowCoverDialog(false)
      setCoverForm({ amount: "", type: "COVER_ADVANCE", coveringParticipantId: "", coveredParticipantId: "", notes: "" })
      fetchShortfalls()
    } catch {
      toast.error("Failed to submit cover")
    } finally {
      setSubmitting(false)
    }
  }, [circleId, projectId, coverForm.amount, coverForm.type, coverForm.coveringParticipantId, coverForm.coveredParticipantId, fetchShortfalls])

  const approveCover = useCallback(async (shortfallId: string) => {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/shortfall/${shortfallId}/approve`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Cover approved")
      fetchShortfalls()
    } catch {
      toast.error("Failed to approve")
    }
  }, [circleId, projectId, fetchShortfalls])

  if (loading) return <ShortfallSkeleton />

  const pending = shortfalls.filter((s) => s.status === "PENDING")
  const approved = shortfalls.filter((s) => s.status === "CONFIRMED")
  const totalShortfall = shortfalls.filter((s) => s.status !== "CANCELLED").reduce((s, sf) => s + Number(sf.amount), 0)
  const totalCovered = approved.reduce((s, sf) => s + Number(sf.amount), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground">Total Shortfall</p>
            <p className="text-base font-bold text-amber-600">{formatCurrency(totalShortfall, symbol)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground">Covered</p>
            <p className="text-base font-bold text-emerald-600">{formatCurrency(totalCovered, symbol)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground">Pending Offers</p>
            <p className="text-base font-bold">{pending.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Shortfall Cover</h3>
        <Button size="sm" className="rounded-xl" onClick={() => setShowCoverDialog(true)}>
          <Plus className="size-3 mr-1" /> Offer Cover
        </Button>
      </div>

      {shortfalls.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-2" />
            <p className="text-sm text-muted-foreground">No shortfalls recorded</p>
            <p className="text-xs text-muted-foreground mt-1">All allocations are fully covered</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {shortfalls.map((sf) => {
            const covering = sf.coveringParticipant?.user?.name || sf.coveringParticipant?.externalName || "Unknown"
            const covered = sf.coveredParticipant?.user?.name || sf.coveredParticipant?.externalName || "General"
            const typeInfo = COVER_TYPES.find((t) => t.value === sf.type)
            const TypeIcon = typeInfo?.icon || AlertTriangle

            return (
              <Card key={sf.id} className="rounded-2xl">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <TypeIcon className="size-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{typeInfo?.label || sf.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {covering} covering {covered !== "General" ? covered : "general shortfall"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${
                            sf.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                            sf.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" :
                            sf.status === "REJECTED" ? "border-red-200 bg-red-50 text-red-700" :
                            "border-slate-200 bg-slate-50 text-slate-600"
                          }`}>{sf.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">{formatDate(sf.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(Number(sf.amount), symbol)}</p>
                      {sf.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => approveCover(sf.id)}>
                            <CheckCircle2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Cover Treatment Explanation */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" /> Coverage Treatment Options
          </h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex gap-2"><Shield className="size-3 shrink-0 mt-0.5" /><span><strong>Cover Advance:</strong> Payment that may be repaid from future distributions</span></div>
            <div className="flex gap-2"><ArrowRightLeft className="size-3 shrink-0 mt-0.5" /><span><strong>Ownership Transfer:</strong> Transfers equity — requires explicit approval and ownership snapshot update</span></div>
            <div className="flex gap-2"><HandHelping className="size-3 shrink-0 mt-0.5" /><span><strong>Project Advance:</strong> Repayable advance from the project to the participant</span></div>
            <div className="flex gap-2"><Gift className="size-3 shrink-0 mt-0.5" /><span><strong>Donation:</strong> No repayment, no ownership effect</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Offer Cover Dialog */}
      <Dialog open={showCoverDialog} onOpenChange={setShowCoverDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Offer Shortfall Cover</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount ({symbol})</Label>
              <Input value={coverForm.amount} onChange={(e) => setCoverForm({ ...coverForm, amount: e.target.value })} placeholder="100000" type="number" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Coverage Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {COVER_TYPES.map((ct) => {
                  const Icon = ct.icon
                  return (
                    <button
                      key={ct.value}
                      onClick={() => setCoverForm({ ...coverForm, type: ct.value })}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        coverForm.type === ct.value
                          ? "border-brand bg-brand/5 ring-1 ring-brand"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Icon className="size-4 mb-1" />
                      <p className="text-xs font-medium">{ct.label}</p>
                      <p className="text-[10px] text-muted-foreground">{ct.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            {coverForm.type === "OWNERSHIP_TRANSFER" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                Ownership transfer requires approval and will create a new ownership snapshot. The covering participant will gain equity in the project.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCoverDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={submitCover} disabled={!coverForm.amount || submitting} className="rounded-xl">
              {submitting ? "Submitting..." : "Submit Cover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShortfallSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-5 w-24" /></CardContent></Card>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>
      ))}
    </div>
  )
}
