"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  FileUp,
  Flag,
  Loader2,
  ArrowRight,
  SkipForward,
  Clock,
  Repeat,
  HandCoins,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface CycleAction {
  id: string
  cycleNumber: number
  status: string
}

interface Identifier {
  id: string
  cycleNumber: number
  name: string
}

interface Props {
  circleId: string
  cycle: CycleAction
  canPrepare: boolean
  canRecord: boolean
  canSkipDefer: boolean
  canSwap: boolean
  canConfirm: boolean
  canReport: boolean
  allowSwap: boolean
  queueCycles: Identifier[]
  isBeneficiary: boolean
}

type ActionType = "prepare" | "record" | "skip" | "defer" | "swap" | "confirm" | "issue" | "proof" | null

export function PayoutActions({
  circleId,
  cycle,
  canPrepare,
  canRecord,
  canSkipDefer,
  canSwap,
  canConfirm,
  canReport,
  allowSwap,
  queueCycles,
  isBeneficiary,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState<ActionType>(null)
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [toCycleId, setToCycleId] = useState("")
  const [reference, setReference] = useState("")
  const [method, setMethod] = useState("")
  const [amount, setAmount] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [proofReference, setProofReference] = useState("")
  const [loading, setLoading] = useState(false)

  const showPrepare = canPrepare && ["UPCOMING", "READY", "BLOCKED"].includes(cycle.status)
  const showRecord = canRecord && ["APPROVED", "PENDING_APPROVAL"].includes(cycle.status)
  const showSkip = canSkipDefer && ["UPCOMING", "READY", "BLOCKED", "PENDING_APPROVAL"].includes(cycle.status)
  const showDefer = canSkipDefer && ["UPCOMING", "READY", "BLOCKED"].includes(cycle.status)
  const showSwap = canSwap && allowSwap && ["UPCOMING", "READY", "BLOCKED"].includes(cycle.status)
  const showConfirm = (isBeneficiary || canConfirm) && cycle.status === "PAID"
  const showIssue = (isBeneficiary || canReport) && cycle.status === "PAID"
  const showProof = canRecord && ["APPROVED", "PAID"].includes(cycle.status)

  async function run() {
    if (!open) return
    setLoading(true)
    try {
      const url = `/api/circles/${circleId}/payouts/${cycle.id}`
      const common = { method: "POST" as const, headers: { "Content-Type": "application/json" } }

      if (open === "confirm") {
        const res = await fetch(`${url}?action=confirm`, common)
        if (!res.ok) throw await res.json()
        toast.success("Receipt confirmed")
      } else if (open === "issue") {
        if (!description) { toast.error("A description is required"); setLoading(false); return }
        const res = await fetch(`${url}?action=report-issue`, {
          ...common,
          body: JSON.stringify({ description }),
        })
        if (!res.ok) throw await res.json()
        toast.success("Issue reported")
      } else if (open === "skip") {
        if (!reason) { toast.error("A reason is required"); setLoading(false); return }
        const res = await fetch(`${url}?action=skip`, { ...common, body: JSON.stringify({ reason }) })
        if (!res.ok) throw await res.json()
        toast.success("Payout skipped")
      } else if (open === "defer") {
        if (!reason) { toast.error("A reason is required"); setLoading(false); return }
        const res = await fetch(`${url}?action=defer`, { ...common, body: JSON.stringify({ reason }) })
        if (!res.ok) throw await res.json()
        toast.success("Payout deferred")
      } else if (open === "swap") {
        if (!toCycleId) { toast.error("Choose a target cycle"); setLoading(false); return }
        if (!reason) { toast.error("A reason is required"); setLoading(false); return }
        const res = await fetch(`${url}?action=swap`, {
          ...common,
          body: JSON.stringify({ toCycleId, reason }),
        })
        if (!res.ok) throw await res.json()
        toast.success("Queue positions swapped")
      } else if (open === "prepare") {
        const res = await fetch(`${url}?action=prepare`, common)
        if (!res.ok) throw await res.json()
        toast.success("Payout prepared")
      } else if (open === "record") {
        const payload: Record<string, unknown> = {}
        if (amount) payload.amount = Number(amount)
        if (reference) payload.reference = reference
        if (method) payload.method = method
        const res = await fetch(`${url}?action=record`, { ...common, body: JSON.stringify(payload) })
        if (!res.ok) throw await res.json()
        toast.success("Payout recorded as paid")
      } else if (open === "proof") {
        if (!file) { toast.error("Select a proof file"); setLoading(false); return }
        const formData = new FormData()
        formData.append("file", file)
        if (proofReference) formData.append("proofReference", proofReference)
        const res = await fetch(`${url}?action=upload-proof`, { method: "POST", body: formData })
        if (!res.ok) throw await res.json()
        toast.success("Proof uploaded")
      }

      setOpen(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.error || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const triggerBtn = (label: string, Icon: React.ComponentType<{ className?: string }>, variant: any = "outline", color = "") => (
    <DialogTrigger
      render={
        <Button variant={variant} size="sm" className={color}>
          <Icon className="size-3.5" /> {label}
        </Button>
      }
    />
  )

  return (
    <div className="flex flex-wrap gap-2">
      {showConfirm && (
        <Dialog open={open === "confirm"} onOpenChange={(v) => setOpen(v ? "confirm" : null)}>
          {triggerBtn("Confirm Receipt", CheckCircle2, "default", "bg-emerald-600 text-white hover:bg-emerald-700")}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Confirm Receipt — Payout #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Confirm that you have received this payout. This marks the payout as received and advances it to completion.
            </p>
            <Button onClick={run} disabled={loading} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirm receipt
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {showPrepare && (
        <Dialog open={open === "prepare"} onOpenChange={(v) => setOpen(v ? "prepare" : null)}>
          {triggerBtn("Prepare", ArrowRight)}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Prepare Payout #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will move the payout to the approval stage (if configured) or mark it approved for payment.
            </p>
            <Button onClick={run} disabled={loading} className="mt-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Prepare payout
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {showRecord && (
        <Dialog open={open === "record"} onOpenChange={(v) => setOpen(v ? "record" : null)}>
          {triggerBtn("Record Payment", HandCoins, "default")}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Record Payout Payment #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input placeholder="Amount paid" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Input placeholder="e.g. Bank transfer" value={method} onChange={(e) => setMethod(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input placeholder="Payment reference" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <Button onClick={run} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />} Record payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showSkip && (
        <Dialog open={open === "skip"} onOpenChange={(v) => setOpen(v ? "skip" : null)}>
          {triggerBtn("Skip", SkipForward)}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Skip Payout #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Reason (required)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this payout being skipped?" />
              <Button onClick={run} disabled={loading} variant="outline">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <SkipForward className="size-4" />} Skip payout
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showDefer && (
        <Dialog open={open === "defer"} onOpenChange={(v) => setOpen(v ? "defer" : null)}>
          {triggerBtn("Defer", Clock)}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Defer Payout #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Reason (required)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this payout being deferred?" />
              <Button onClick={run} disabled={loading} variant="outline">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />} Defer payout
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showSwap && (
        <Dialog open={open === "swap"} onOpenChange={(v) => setOpen(v ? "swap" : null)}>
          {triggerBtn("Swap", Repeat)}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Swap Payout #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Swap with cycle</Label>
                <select
                  value={toCycleId}
                  onChange={(e) => setToCycleId(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Select a cycle</option>
                  {queueCycles.filter((c) => c.id !== cycle.id).map((c) => (
                    <option key={c.id} value={c.id}>#{c.cycleNumber} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Reason (required)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <Button onClick={run} disabled={loading} variant="outline">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />} Swap positions
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showProof && (
        <Dialog open={open === "proof"} onOpenChange={(v) => setOpen(v ? "proof" : null)}>
          {triggerBtn("Upload Proof", FileUp)}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Upload Payout Proof #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Proof file</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-1">
                <Label>Reference (optional)</Label>
                <Input value={proofReference} onChange={(e) => setProofReference(e.target.value)} />
              </div>
              <Button onClick={run} disabled={loading} variant="outline">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Upload proof
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showIssue && (
        <Dialog open={open === "issue"} onOpenChange={(v) => setOpen(v ? "issue" : null)}>
          {triggerBtn("Report Issue", Flag, "outline", "text-red-600")}
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Report Issue — Payout #{cycle.cycleNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Describe the issue (required)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. I never received the funds" />
              <Button onClick={run} disabled={loading} variant="outline" className="text-red-600">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />} Report issue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
