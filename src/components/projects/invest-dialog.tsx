"use client"

import { useRef, useState } from "react"
import { Upload, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { formatCurrency } from "./types"

export function InvestDialog({
  open,
  onOpenChange,
  circleId,
  projectId,
  currency,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  circleId: string
  projectId: string
  currency: string
  onSuccess?: () => void
}) {
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const symbol = currency || "ZAR"

  const reset = () => {
    setAmount("")
    setReference("")
    setFile(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const submit = async () => {
    const value = Number(amount)
    if (!value || value <= 0) {
      toast.error("Enter a valid investment amount")
      return
    }
    setSubmitting(true)
    try {
      const base = `/api/circles/${circleId}/projects/${projectId}`
      // Commit capital (auto-creates the member's participant record).
      const record = await fetch(`${base}/capital?action=record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, classification: "REQUIRED_EQUITY", reference: reference || undefined }),
      })
      const recordJson = await record.json().catch(() => ({}))
      if (!record.ok) throw new Error(recordJson.error || "Failed to record your investment")
      const txId = recordJson.id
      if (!txId) throw new Error("No transaction created")

      // Submit live proof (file or reference) straight after committing — status → PROOF_SUBMITTED.
      if (file || reference.trim()) {
        const fd = new FormData()
        if (file) fd.append("file", file)
        if (reference.trim()) fd.append("reference", reference.trim())
        const proof = await fetch(`${base}/capital/${txId}/proof`, { method: "POST", body: fd })
        const proofJson = await proof.json().catch(() => ({}))
        if (!proof.ok) throw new Error(proofJson.error || "Failed to submit proof")
      }

      toast.success(`Investment of ${formatCurrency(value, symbol)} submitted — pending approval`)
      onSuccess?.()
      setShowSuccess(true)
      reset()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const [showSuccess, setShowSuccess] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setShowSuccess(false) }}>
      <DialogContent className="sm:max-w-md">
        {showSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" /> Investment submitted
              </DialogTitle>
              <DialogDescription>
                Your commitment was recorded and is now pending review. Track approval from the Capital tab.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => { setShowSuccess(false); onOpenChange(false) }} className="rounded-xl">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invest in this project</DialogTitle>
              <DialogDescription>
                Commit your own capital. Your payment proof is reviewed before the investment is confirmed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Amount ({symbol})</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500000" type="number" min={0} className="rounded-xl text-lg font-semibold" />
              </div>
              <div className="space-y-2">
                <Label>Proof of payment</Label>
                <label
                  className="flex items-center gap-3 rounded-xl border border-dashed p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <span className="size-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <Upload className="size-4 text-brand" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{file ? file.name : "Upload proof (JPG, PNG, WebP, PDF · max 5MB)"}</span>
                    <span className="block text-[10px] text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : "Bank proof, receipt or reference document"}</span>
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp,.heic,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <Label>Reference / Note</Label>
                <Textarea value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank reference, transaction ID..." className="rounded-xl" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting} className="rounded-xl bg-brand hover:bg-brand-600">
                {submitting ? "Committing..." : `Commit ${amount ? formatCurrency(Number(amount), symbol) : ""}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}