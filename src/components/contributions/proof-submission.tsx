"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, FileImage, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { VerificationBadge } from "@/components/contributions/contribution-status-badge"

interface ProofData {
  proofUrl?: string | null
  proofReference?: string | null
  paymentMethod?: string | null
  contributionMonth?: string | null
  verificationStatus?: string | null
  confidenceScore?: number | null
  extractedAmount?: string | number | null
  extractedDate?: string | null
  extractedReference?: string | null
  verificationReason?: string | null
}

interface ProofSubmissionProps {
  circleId: string
  contributionId: string
  contribution: ProofData
  canManage: boolean
  currencySymbol: string
}

export function ProofSubmission({ circleId, contributionId, contribution, canManage, currencySymbol }: ProofSubmissionProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [approving, setApproving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [contributionMonth, setContributionMonth] = useState(contribution.contributionMonth || "")
  const [paymentMethod, setPaymentMethod] = useState(contribution.paymentMethod || "BANK_TRANSFER")
  const [proofReference, setProofReference] = useState(contribution.proofReference || "")
  const [verification, setVerification] = useState<any>(null)
  const [verificationRun, setVerificationRun] = useState(!!contribution.verificationStatus && contribution.verificationStatus !== "PENDING")

  const hasProof = !!contribution.proofUrl

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("contributionMonth", contributionMonth)
      formData.append("paymentMethod", paymentMethod)
      if (proofReference) formData.append("proofReference", proofReference)

      const r = await fetch(`/api/circles/${circleId}/contributions/${contributionId}?action=upload-proof`, {
        method: "POST", body: formData,
      })
      if (!r.ok) { const err = await r.json(); toast.error(err.error || "Upload failed"); return }
      toast.success("Proof uploaded. Running verification...")

      const vR = await fetch(`/api/circles/${circleId}/contributions/${contributionId}?action=verify`, { method: "POST" })
      if (vR.ok) {
        const v = await vR.json()
        setVerification(v)
        setVerificationRun(true)
        if (v.status === "VERIFIED") toast.success("Auto-verified!")
        else if (v.status === "NEEDS_REVIEW") toast.warning("Needs admin review")
        else toast.error("Verification rejected")
      }
    } catch { toast.error("Failed to upload proof") }
    finally { setUploading(false) }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/contributions/${contributionId}?action=verify`, { method: "POST" })
      if (r.ok) {
        const v = await r.json()
        setVerification(v)
        setVerificationRun(true)
        toast.success(v.status === "VERIFIED" ? "Auto-verified!" : v.status === "NEEDS_REVIEW" ? "Needs review" : "Rejected")
      } else toast.error("Verification failed")
    } finally { setVerifying(false) }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/contributions/${contributionId}?action=approve`, { method: "POST" })
      if (r.ok) { toast.success("Contribution approved"); open && setOpen(false); router.refresh() }
      else toast.error("Failed to approve")
    } finally { setApproving(false) }
  }

  const handleReject = async () => {
    const reason = prompt("Reason for rejection:")
    if (!reason) return
    setApproving(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/contributions/${contributionId}?action=reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (r.ok) { toast.success("Rejected"); open && setOpen(false); router.refresh() }
      else toast.error("Failed to reject")
    } finally { setApproving(false) }
  }

  const v = verification || {
    status: contribution.verificationStatus,
    confidenceScore: contribution.confidenceScore,
    extractedAmount: contribution.extractedAmount,
    extractedDate: contribution.extractedDate,
    extractedReference: contribution.extractedReference,
    reason: contribution.verificationReason,
  }

  return (
    <>
      {/* Inline proof preview + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasProof && (
          <a href={contribution.proofUrl!} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline flex items-center gap-1">
            <FileImage className="size-3" /> View Proof
          </a>
        )}
        {contribution.verificationStatus !== "PENDING" && (
          <VerificationBadge status={contribution.verificationStatus} />
        )}
        {!hasProof && (
          <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setOpen(true)}>
            <Upload className="size-3 mr-1" /> Upload Proof
          </Button>
        )}
        {contribution.verificationStatus === "NEEDS_REVIEW" && canManage && (
          <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs text-emerald-600" onClick={handleApprove} disabled={approving}>
            <CheckCircle2 className="size-3 mr-1" /> Approve
          </Button>
        )}
        {contribution.verificationStatus === "NEEDS_REVIEW" && canManage && (
          <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs text-red-600" onClick={handleReject} disabled={approving}>
            <XCircle className="size-3 mr-1" /> Reject
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Submit Proof of Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!hasProof && (
              <div className="space-y-1">
                <Label className="text-xs">Proof Document *</Label>
                <div className="flex items-center gap-2">
                  <Input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="rounded-xl h-9 text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <p className="text-[10px] text-muted-foreground">JPG, PNG, PDF up to 5MB</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "BANK_TRANSFER")}>
                  <SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                    <SelectItem value="EFT">EFT</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contribution Month</Label>
                <Input type="month" className="rounded-xl h-9" value={contributionMonth} onChange={(e) => setContributionMonth(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference / Transaction ID</Label>
              <Input className="rounded-xl h-9" placeholder="EFT reference number" value={proofReference} onChange={(e) => setProofReference(e.target.value)} />
            </div>

            {hasProof && (
              <a href={contribution.proofUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl border text-sm hover:bg-muted/50">
                <FileText className="size-5 text-brand" />
                <span className="text-brand hover:underline">View uploaded proof</span>
              </a>
            )}

            {verificationRun && v && (
              <Card className="rounded-xl">
                <CardContent className="p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Verification:</span>
                    <VerificationBadge status={v.status} />
                    {v.confidenceScore != null && <span className="text-muted-foreground">({Math.round(v.confidenceScore * 100)}% confidence)</span>}
                  </div>
                  {v.extractedAmount != null && <p>Amount: {currencySymbol}{Number(v.extractedAmount).toLocaleString()}</p>}
                  {v.extractedDate && <p>Date: {new Date(v.extractedDate).toLocaleDateString()}</p>}
                  {v.extractedReference && <p>Reference: {v.extractedReference}</p>}
                  {v.reason && <p className="text-muted-foreground">{v.reason}</p>}
                  {v.status === "NEEDS_REVIEW" ? (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="rounded-xl h-7 text-xs" onClick={handleVerify} disabled={verifying}>
                        {verifying ? <Loader2 className="size-3 animate-spin" /> : "Re-verify"}
                      </Button>
                    </div>
                  ) : v.status === "REJECTED" ? (
                    <div className="flex gap-2 pt-1">
                      <p className="text-red-600 font-medium">Upload a different proof document</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Close</Button>
            {file && !hasProof && (
              <Button className="rounded-xl bg-brand hover:bg-brand-600" onClick={handleUpload} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <><Upload className="size-4 mr-1" />Upload & Verify</>}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
