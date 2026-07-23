"use client"

import { useState, useEffect } from "react"
import { Plus, Power, PowerOff, Users, AlertTriangle, CheckCircle2, Clock, ChevronRight, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate, ROUND_STATUS_COLORS } from "../types"
import type { FundingRoundData, CircleData } from "../types"

interface FundingTabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

export function FundingTab({ circle, circleId, projectId }: FundingTabProps) {
  const [rounds, setRounds] = useState<FundingRoundData[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newRound, setNewRound] = useState({ name: "", targetAmount: "", allocationMethod: "EQUAL" })

  const symbol = circle?.currency || "ZAR"

  useEffect(() => {
    fetchRounds()
  }, [circleId, projectId])

  async function fetchRounds() {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/funding-rounds`)
      if (r.ok) {
        const data = await r.json()
        setRounds(data.rounds || [])
        setSummary(data.summary || null)
      }
    } finally {
      setLoading(false)
    }
  }

  async function createRound() {
    if (!newRound.name || !newRound.targetAmount) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/funding-rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRound.name,
          targetAmount: Number(newRound.targetAmount),
          allocationMethod: newRound.allocationMethod,
        }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Funding round created")
      setShowCreateDialog(false)
      setNewRound({ name: "", targetAmount: "", allocationMethod: "EQUAL" })
      fetchRounds()
    } catch {
      toast.error("Failed to create round")
    } finally {
      setSubmitting(false)
    }
  }

  async function transitionRound(roundId: string, action: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/funding-rounds/${roundId}/${action}`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success(`Round ${action}ed`)
      fetchRounds()
    } catch {
      toast.error(`Failed to ${action} round`)
    }
  }

  if (loading) return <FundingSkeleton />

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total Raised" value={formatCurrency(summary.raised || 0, symbol)} />
          <SummaryCard label="Total Target" value={formatCurrency(summary.totalTarget || 0, symbol)} />
          <SummaryCard label="Committed" value={formatCurrency(summary.totalCommitted || 0, symbol)} />
          <SummaryCard label="Shortfall" value={formatCurrency(summary.totalShortfall || 0, symbol)} warning={Number(summary.totalShortfall || 0) > 0} />
        </div>
      )}

      {/* Create round button */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Funding Rounds</h3>
        <Button size="sm" className="rounded-xl" onClick={() => setShowCreateDialog(true)}>
          <Plus className="size-3 mr-1" /> New Round
        </Button>
      </div>

      {/* Round cards */}
      {rounds.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <FolderOpen className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No funding rounds yet</p>
            <Button size="sm" className="rounded-xl mt-3" onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-3 mr-1" /> Create Round
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const roundProgress = Number(round.targetAmount) > 0
              ? Math.round((Number(round.currentAmount) / Number(round.targetAmount)) * 100)
              : 0
            return (
              <Card key={round.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{round.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${ROUND_STATUS_COLORS[round.status] || ""}`}>{round.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">{round.allocationMethod}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {round.status === "DRAFT" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => transitionRound(round.id, "open")}>
                          <Power className="size-3 mr-1" /> Open
                        </Button>
                      )}
                      {round.status === "OPEN" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => transitionRound(round.id, "close")}>
                          <PowerOff className="size-3 mr-1" /> Close
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{formatCurrency(Number(round.currentAmount), symbol)} raised</span>
                    <span>{formatCurrency(Number(round.targetAmount), symbol)} target</span>
                  </div>

                  <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                    <div className={`h-2 rounded-full transition-all ${roundProgress >= 100 ? "bg-emerald-500" : "bg-brand"}`} style={{ width: `${Math.min(roundProgress, 100)}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>{roundProgress}% funded</span>
                    {round.opensAt && <span>Opened {formatDate(round.opensAt)}</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Round Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Funding Round</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Round Name</Label>
              <Input value={newRound.name} onChange={(e) => setNewRound({ ...newRound, name: e.target.value })} placeholder="e.g. Seed Round" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Target Amount ({symbol})</Label>
              <Input value={newRound.targetAmount} onChange={(e) => setNewRound({ ...newRound, targetAmount: e.target.value })} placeholder="5000000" type="number" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Allocation Method</Label>
              <Select value={newRound.allocationMethod} onValueChange={(v) => setNewRound({ ...newRound, allocationMethod: v || "EQUAL" })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EQUAL">Equal</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={createRound} disabled={!newRound.name || !newRound.targetAmount || submitting} className="rounded-xl">
              {submitting ? "Creating..." : "Create Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-base font-bold mt-0.5 ${warning ? "text-amber-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function FundingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-5 w-24" /></CardContent></Card>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-20 w-full rounded-xl" /></CardContent></Card>
      ))}
    </div>
  )
}
