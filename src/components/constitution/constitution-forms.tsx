"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Ban, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ConstitutionAmendment, ConstitutionRuleConflict } from "@/generated/prisma"

export function AmendDialog({
  circleId,
  versionId,
  clauseKey,
  clauseTitle,
  canAmend,
}: {
  circleId: string
  versionId: string
  clauseKey: string
  clauseTitle: string
  canAmend: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState("")
  const [newValue, setNewValue] = useState("")

  if (!canAmend) return null

  async function propose() {
    let parsed: unknown = newValue
    try {
      parsed = JSON.parse(newValue)
    } catch {
      // keep as raw string if not valid JSON
    }
    setBusy(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/constitution/amendments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          clauseKey,
          clauseTitle,
          newValue: parsed,
          reason,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error || "Failed to propose amendment")
      } else {
        toast.success("Amendment proposed")
        setOpen(false)
        router.refresh()
      }
    } catch {
      toast.error("Failed to propose amendment")
    }
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-lg" />}>
        <Pencil className="size-3.5 mr-1" /> Amend
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose amendment</DialogTitle>
          <DialogDescription>
            Amend clause &ldquo;{clauseTitle}&rdquo;. This requires governance review before approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>New value (JSON or text)</Label>
            <Textarea value={newValue} onChange={(e) => setNewValue(e.target.value)} rows={4} placeholder={'{"enabled": true, "amount": 1000}'} />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this change needed?" />
          </div>
        </div>
        <DialogFooter>
          <DialogTrigger render={<Button variant="outline" />}>Cancel</DialogTrigger>
          <Button onClick={propose} disabled={busy}>
            {busy && <Loader2 className="size-3.5 mr-1 animate-spin" />} Propose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReviewAmendmentButtons({
  circleId,
  amendment,
  canAmend,
}: {
  circleId: string
  amendment: ConstitutionAmendment
  canAmend: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  if (!canAmend || amendment.status !== "PROPOSED") return null

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(decision)
    try {
      const r = await fetch(`/api/circles/${circleId}/constitution/amendments/${amendment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error || "Failed to review")
      } else {
        toast.success(decision === "APPROVED" ? "Amendment approved" : "Amendment rejected")
        router.refresh()
      }
    } catch {
      toast.error("Failed to review")
    }
    setBusy(null)
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700" onClick={() => decide("APPROVED")} disabled={busy !== null}>
        {busy === "APPROVED" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1" />} Approve
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => decide("REJECTED")} disabled={busy !== null}>
        {busy === "REJECTED" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Ban className="size-3.5 mr-1" />} Reject
      </Button>
    </div>
  )
}

export function ResolveConflictDialog({
  circleId,
  conflict,
  canResolve,
}: {
  circleId: string
  conflict: ConstitutionRuleConflict
  canResolve: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState("")
  const [resolution, setResolution] = useState("")

  if (!canResolve || conflict.status !== "OPEN") return null

  async function resolve() {
    setBusy(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/constitution/conflicts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflictId: conflict.id, action, resolution: resolution || {} }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error || "Failed to resolve")
      } else {
        toast.success("Conflict resolved")
        setOpen(false)
        router.refresh()
      }
    } catch {
      toast.error("Failed to resolve")
    }
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-lg" />}>
        <CheckCircle2 className="size-3.5 mr-1" /> Resolve
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve rule conflict</DialogTitle>
          <DialogDescription>
            Conflict on rule &ldquo;{conflict.ruleKey}&rdquo; vs setting &ldquo;{conflict.settingKey}&rdquo;. Choose the source of truth.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Resolution action</Label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Constitution overrides circle settings" />
          </div>
          <div className="space-y-1">
            <Label>Resolution (JSON)</Label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder='{"sourceOfTruth": "CONSTITUTION"}' />
          </div>
        </div>
        <DialogFooter>
          <DialogTrigger render={<Button variant="outline" />}>Cancel</DialogTrigger>
          <Button onClick={resolve} disabled={busy}>
            {busy && <Loader2 className="size-3.5 mr-1 animate-spin" />} Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
