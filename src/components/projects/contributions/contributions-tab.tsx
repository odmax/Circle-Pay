"use client"

import { useState, useEffect } from "react"
import { Plus, Upload, CheckCircle2, XCircle, FileText, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency, formatDate, CAPITAL_TX_STATUS_COLORS, CAPITAL_CLASSIFICATION_LABELS } from "../types"
import type { CapitalTransactionData, CircleData } from "../types"

interface ContributionsTabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

export function ContributionsTab({ circle, circleId, projectId }: ContributionsTabProps) {
  const [transactions, setTransactions] = useState<CapitalTransactionData[]>([])
  const [loading, setLoading] = useState(true)
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [showProofDialog, setShowProofDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedTx, setSelectedTx] = useState<CapitalTransactionData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filterClassification, setFilterClassification] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const symbol = circle?.currency || "ZAR"

  const [newTx, setNewTx] = useState({ participantId: "", amount: "", classification: "REQUIRED_EQUITY", reference: "" })

  useEffect(() => { fetchTransactions() }, [circleId, projectId])

  async function fetchTransactions() {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/capital`)
      if (r.ok) {
        const data = await r.json()
        setTransactions(data.transactions || data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function recordTransaction() {
    if (!newTx.amount) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/capital`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: newTx.participantId || undefined,
          amount: Number(newTx.amount),
          classification: newTx.classification,
          reference: newTx.reference || undefined,
        }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Capital transaction recorded")
      setShowRecordDialog(false)
      setNewTx({ participantId: "", amount: "", classification: "REQUIRED_EQUITY", reference: "" })
      fetchTransactions()
    } catch {
      toast.error("Failed to record transaction")
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmTransaction(txId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/capital/${txId}/confirm`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Transaction confirmed")
      fetchTransactions()
    } catch {
      toast.error("Failed to confirm")
    }
  }

  async function submitProof() {
    if (!selectedTx) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/capital/${selectedTx.id}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: proofReference }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Proof submitted")
      setShowProofDialog(false)
      setProofReference("")
      fetchTransactions()
    } catch {
      toast.error("Failed to submit proof")
    } finally {
      setSubmitting(false)
    }
  }

  const [proofReference, setProofReference] = useState("")

  const filtered = transactions.filter((tx) => {
    if (filterClassification !== "all" && tx.classification !== filterClassification) return false
    if (filterStatus !== "all" && tx.status !== filterStatus) return false
    return true
  })

  if (loading) return <ContributionsSkeleton />

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-4 text-muted-foreground" />
        <Select value={filterClassification} onValueChange={(v) => setFilterClassification(v || "all")}>
          <SelectTrigger className="w-40 rounded-xl h-8 text-xs"><SelectValue placeholder="Classification" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(CAPITAL_CLASSIFICATION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v || "all")}>
          <SelectTrigger className="w-32 rounded-xl h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" className="rounded-xl" onClick={() => setShowRecordDialog(true)}>
          <Plus className="size-3 mr-1" /> Record Capital
        </Button>
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No capital transactions recorded</p>
            <Button size="sm" className="rounded-xl mt-3" onClick={() => setShowRecordDialog(true)}>
              <Plus className="size-3 mr-1" /> Record Capital
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const participantName = tx.participant?.user?.name || tx.participant?.externalName || "Unknown"
            return (
              <Card key={tx.id} className="rounded-2xl">
                <CardContent className="p-3 sm:p-4">
                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium truncate">{participantName}</p>
                      <p className="text-sm font-bold shrink-0">{formatCurrency(Number(tx.amount), symbol)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${CAPITAL_TX_STATUS_COLORS[tx.status] || ""}`}>{tx.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CAPITAL_CLASSIFICATION_LABELS[tx.classification] || tx.classification}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</span>
                    </div>
                    <div className="flex gap-1">
                      {tx.status === "PENDING" && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setSelectedTx(tx); setShowProofDialog(true) }}>
                          <Upload className="size-3 mr-1" /> Proof
                        </Button>
                      )}
                      {tx.status === "PENDING" && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-600" onClick={() => confirmTransaction(tx.id)}>
                          <CheckCircle2 className="size-3 mr-1" /> Confirm
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{participantName}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] ${CAPITAL_TX_STATUS_COLORS[tx.status] || ""}`}>{tx.status}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CAPITAL_CLASSIFICATION_LABELS[tx.classification] || tx.classification}</Badge>
                        {tx.reference && <span className="text-[10px] text-muted-foreground">{tx.reference}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(Number(tx.amount), symbol)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                      </div>
                      <div className="flex gap-1">
                        {tx.status === "PENDING" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSelectedTx(tx); setShowProofDialog(true) }}>
                              <Upload className="size-3 mr-1" /> Proof
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => confirmTransaction(tx.id)}>
                              <CheckCircle2 className="size-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Record Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Capital Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount ({symbol})</Label>
              <Input value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} placeholder="500000" type="number" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Classification</Label>
              <Select value={newTx.classification} onValueChange={(v) => setNewTx({ ...newTx, classification: v || "REQUIRED_EQUITY" })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAPITAL_CLASSIFICATION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={newTx.reference} onChange={(e) => setNewTx({ ...newTx, reference: e.target.value })} placeholder="Payment reference" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={recordTransaction} disabled={!newTx.amount || submitting} className="rounded-xl">
              {submitting ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof Dialog */}
      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Submit Proof of Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reference / Note</Label>
              <Textarea value={proofReference} onChange={(e) => setProofReference(e.target.value)} placeholder="Bank reference, transaction ID, or note..." className="rounded-xl" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProofDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={submitProof} disabled={submitting} className="rounded-xl">
              {submitting ? "Submitting..." : "Submit Proof"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContributionsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-14 w-full rounded-xl" /></CardContent></Card>
      ))}
    </div>
  )
}
