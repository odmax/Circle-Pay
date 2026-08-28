"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Landmark,
  RefreshCw,
  AlertTriangle,
  FileWarning,
  CheckCircle2,
  XCircle,
  Banknote,
  ShieldCheck,
  Clock,
  Wallet,
  Lock,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

export interface LoanDetailPermissions {
  isOwner: boolean
  canApply: boolean
  canApprove: boolean
  canDisburse: boolean
  canReviewRepayments: boolean
  canReview: boolean
}

interface LoanDetailClientProps {
  circleId: string
  loanId: string
  userId: string
  symbol: string
  permissions: LoanDetailPermissions
}

interface ScheduleItem {
  id: string
  periodNumber: number
  dueDate: string | null
  principalDue: string
  interestDue: string
  totalDue: string
  amountPaid: string
  status: string
}

interface ProofItem {
  id: string
  kind: string
  repaymentId: string | null
  disbursementId: string | null
  fileUrl: string
  filename: string
  mimeType: string
  size: number
  reference: string | null
  note: string | null
  uploadedByName: string | null
  uploadedById: string
  uploadedAt: string | null
}

interface RepaymentItem {
  id: string
  scheduleId: string
  amount: string
  status: string
  proofUrl: string | null
  proofReference: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  createdAt: string | null
  proofs: ProofItem[]
}

interface DisbursementDetail {
  id: string
  amount: string
  method: string | null
  reference: string | null
  status: string
  proofUrl: string | null
  proofReference: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  createdAt: string | null
  proofs: ProofItem[]
}

interface LoanDetail {
  id: string
  memberId: string
  memberName: string
  principal: string
  serviceFee: string
  interestRate: string
  termMonths: number
  repaymentFrequency: string
  status: string
  purpose: string | null
  requestedAt: string | null
  approvedAt: string | null
  disbursedAt: string | null
  schedule: ScheduleItem[]
  repayments: RepaymentItem[]
  disbursement: DisbursementDetail | null
  canViewAny: boolean
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DISBURSED: "Disbursed",
  REPAYING: "Repaying",
  PAID_OFF: "Paid off",
  OVERDUE: "Overdue",
  DEFAULTED: "Defaulted",
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "border-sky-200 bg-sky-50 text-sky-700",
  UNDER_REVIEW: "border-sky-200 bg-sky-50 text-sky-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  DISBURSED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  REPAYING: "border-blue-200 bg-blue-50 text-blue-700",
  PAID_OFF: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-orange-200 bg-orange-50 text-orange-700",
  DEFAULTED: "border-red-200 bg-red-50 text-red-700",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
}

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROOF_SUBMITTED: "Proof submitted",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  OVERDUE: "Overdue",
  WAIVED: "Waived",
}

const REPAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROOF_SUBMITTED: "Proof submitted",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  OVERDUE: "Overdue",
  WAIVED: "Waived",
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
}

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—"
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Request failed")
  }
  return data
}

async function postMultipart(url: string, fields: Record<string, string | undefined>, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) formData.append(key, value)
  }
  const res = await fetch(url, { method: "POST", body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Upload failed")
  }
  return data
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/")
}

function ProofPreview({ proof }: { proof: ProofItem }) {
  const preview = isImage(proof.mimeType) ? (
    <a href={proof.fileUrl} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proof.fileUrl}
        alt={proof.filename}
        className="h-12 w-12 rounded-md border border-border/60 object-cover"
        loading="lazy"
      />
    </a>
  ) : (
    <a
      href={proof.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-border/60 bg-muted text-xs font-semibold text-brand"
      title={proof.filename}
    >
      PDF
    </a>
  )

  return (
    <span className="inline-flex items-center gap-2">
      {preview}
      <a href={proof.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand underline">
        {proof.filename}
      </a>
    </span>
  )
}

export function LoanDetailClient({ circleId, loanId, symbol, permissions }: LoanDetailClientProps) {
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Repayment submission form
  const [repayScheduleId, setRepayScheduleId] = useState("")
  const [repayAmount, setRepayAmount] = useState("")
  const [repayFile, setRepayFile] = useState<File | null>(null)
  const [repayNote, setRepayNote] = useState("")
  const [showRepayForm, setShowRepayForm] = useState(false)

  // Disbursement form
  const [disbAmount, setDisbAmount] = useState("")
  const [disbMethod, setDisbMethod] = useState("")
  const [disbReference, setDisbReference] = useState("")
  const [disbFile, setDisbFile] = useState<File | null>(null)
  const [disbNote, setDisbNote] = useState("")
  const [showDisbForm, setShowDisbForm] = useState(false)

  // Reject reason inputs
  const [rejectReason, setRejectReason] = useState("")
  const [rejecting, setRejecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/circles/${circleId}/loans/${loanId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load loan")
      setLoan(data.loan ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load loan")
    } finally {
      setLoading(false)
    }
  }, [circleId, loanId])

  useEffect(() => {
    load()
  }, [load])

  const action = async (name: string, url: string, body?: unknown) => {
    setBusy(name)
    try {
      await post(url, body)
      toast.success(`Loan ${name} successful`)
      setRejecting(false)
      setRejectReason("")
      setShowDisbForm(false)
      setShowRepayForm(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const submitRepaymentProof = async () => {
    if (!repayFile || !repayScheduleId || !Number(repayAmount)) {
      toast.error("Select a period, enter an amount, and choose a proof file")
      return
    }
    setBusy("submit repayment")
    try {
      await postMultipart(
        `/api/circles/${circleId}/loans/${loanId}/repayments/proof`,
        { scheduleId: repayScheduleId, amount: repayAmount, note: repayNote || undefined },
        repayFile
      )
      toast.success("Repayment proof submitted")
      setShowRepayForm(false)
      setRepayFile(null)
      setRepayNote("")
      setRepayAmount("")
      setRepayScheduleId("")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(null)
    }
  }

  const submitDisbursementProof = async () => {
    if (!disbFile) {
      toast.error("Choose a proof file")
      return
    }
    setBusy("disburse")
    try {
      await postMultipart(
        `/api/circles/${circleId}/loans/${loanId}/disburse/proof`,
        { amount: disbAmount || undefined, method: disbMethod || undefined, reference: disbReference || undefined, note: disbNote || undefined },
        disbFile
      )
      toast.success("Disbursement proof submitted")
      setShowDisbForm(false)
      setDisbFile(null)
      setDisbNote("")
      setDisbAmount("")
      setDisbMethod("")
      setDisbReference("")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  if (error || !loan) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertTriangle className="size-8 text-red-500" />
          <p className="text-sm text-muted-foreground">{error || "Loan not found."}</p>
          <Button variant="outline" size="sm" className="rounded-xl" render={<Link href={`/circles/${circleId}/loans`} />}>
            <ArrowLeft className="size-4 mr-1" /> Back to loans
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isOwner = permissions.isOwner
  const isHighAccess = !isOwner && loan.canViewAny
  const admin = permissions.canApprove || permissions.canDisburse || permissions.canReviewRepayments || permissions.canReview

  const outstanding = loan.schedule
    .filter((s) => s.status === "PENDING" || s.status === "PROOF_SUBMITTED" || s.status === "OVERDUE")
    .reduce((sum, s) => sum + (Number(s.totalDue) - Number(s.amountPaid)), 0)

  const unpaid = loan.schedule.filter((s) => s.status !== "CONFIRMED")
  const nextSchedule = unpaid[0] ?? null

  const awaitingRepayment = loan.repayments.find((r) => r.status === "PROOF_SUBMITTED")

  // Admin action availability by status + permission
  const canSubmitForApproval =
    (loan.status === "SUBMITTED" || loan.status === "UNDER_REVIEW" || loan.status === "DRAFT") &&
    permissions.canReview
  const canApprove =
    (loan.status === "SUBMITTED" || loan.status === "UNDER_REVIEW") && permissions.canApprove && !isOwner
  const canRejectLoan =
    (loan.status === "SUBMITTED" || loan.status === "UNDER_REVIEW" || loan.status === "DRAFT") &&
    permissions.canApprove &&
    !isOwner
  const canRecordDisbursement = loan.status === "APPROVED" && permissions.canDisburse
  const canConfirmDisbursement =
    (loan.status === "DISBURSED") && permissions.canDisburse
  const canRejectDisbursement = loan.status === "DISBURSED" && permissions.canDisburse
  const canConfirmRepayment = !!awaitingRepayment && permissions.canReviewRepayments && !isOwner
  const canRejectRepayment = !!awaitingRepayment && permissions.canReviewRepayments && !isOwner
  const canMarkOverdue =
    (loan.status === "REPAYING" || loan.status === "DISBURSED" || loan.status === "APPROVED") &&
    permissions.canReviewRepayments
  const canMarkDefaulted = loan.status === "OVERDUE" && permissions.canReviewRepayments

  const canSubmitRepayment =
    (loan.status === "REPAYING" || loan.status === "OVERDUE") &&
    (isOwner
      ? true
      : permissions.canReviewRepayments)

  // Read-only signal: an admin action is pending in the current status, but the
  // viewer lacks the required permission (so no button is rendered).
  const readOnlyAdmin =
    admin &&
    !isOwner &&
    ((loan.status === "SUBMITTED" || loan.status === "UNDER_REVIEW" || loan.status === "DRAFT") && !permissions.canApprove && !permissions.canReview) ||
    (loan.status === "APPROVED" || loan.status === "DISBURSED") && !permissions.canDisburse ||
    !!awaitingRepayment && !permissions.canReviewRepayments ||
    (loan.status === "REPAYING" || loan.status === "OVERDUE") && !permissions.canReviewRepayments

  const disbPresent =
    loan.status === "DISBURSED" || loan.status === "REPAYING" || loan.status === "OVERDUE" || loan.status === "PAID_OFF"

  return (
    <div className="space-y-6">
      {/* Member / access banner */}
      {isHighAccess && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" />
          Viewing loan for <span className="font-medium">{loan.memberName}</span> — you have elevated access.
        </div>
      )}

      {/* Status banner */}
      {loan.status === "OVERDUE" && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <Clock className="size-4 shrink-0 mt-0.5 text-orange-600" />
          <div>
            <p className="text-sm font-medium text-orange-700">This loan is overdue</p>
            <p className="text-xs text-orange-600">Please submit a repayment for the outstanding period.</p>
          </div>
        </div>
      )}
      {loan.status === "DEFAULTED" && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <FileWarning className="size-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">This loan has been defaulted</p>
            <p className="text-xs text-red-600">Contact the circle administrators for more information.</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/40 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              <span className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" /> Loan summary
              </span>
            </CardTitle>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[loan.status] ?? ""}`}>
              {STATUS_LABELS[loan.status] ?? loan.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-bold">{symbol}{Number(loan.principal).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isHighAccess ? `Applicant: ${loan.memberName}` : "Your loan principal"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Term</p>
                <p className="font-semibold">{loan.termMonths} mo</p>
              </div>
              <div>
                <p className="text-muted-foreground">Frequency</p>
                <p className="font-semibold">{FREQ_LABELS[loan.repaymentFrequency] ?? loan.repaymentFrequency}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Interest</p>
                <p className="font-semibold">{Number(loan.interestRate) * 100}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Service fee</p>
                <p className="font-semibold">{symbol}{Number(loan.serviceFee).toLocaleString()}</p>
              </div>
            </div>

            {loan.purpose && (
              <div>
                <p className="text-xs text-muted-foreground">Purpose</p>
                <p className="text-sm">{loan.purpose}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Requested</p>
                <p className="font-medium">{fmtDate(loan.requestedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Approved</p>
                <p className="font-medium">{fmtDate(loan.approvedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding balance</p>
              <p className={`text-2xl font-bold ${outstanding > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                {symbol}{outstanding.toLocaleString()}
              </p>
            </div>
            <div className="border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">Next repayment</p>
              {nextSchedule ? (
                <div>
                  <p className="font-semibold">{symbol}{Math.max(0, Number(nextSchedule.totalDue) - Number(nextSchedule.amountPaid)).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    due {fmtDate(nextSchedule.dueDate)} · period {nextSchedule.periodNumber}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-emerald-600">Fully repaid</p>
                  <p className="text-xs text-muted-foreground">No outstanding periods.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin actions */}
      {isHighAccess && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Admin actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {canSubmitForApproval && (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => action("submit", `/api/circles/${circleId}/loans/${loanId}/submit`)} disabled={busy !== null}>
                  <RefreshCw className="size-4 mr-1" /> Submit for approval
                </Button>
              )}

              {!isOwner && (canApprove && (
                <Button size="sm" className="rounded-xl" onClick={() => action("approve", `/api/circles/${circleId}/loans/${loanId}/approve`)} disabled={busy !== null}>
                  <CheckCircle2 className="size-4 mr-1" /> Approve
                </Button>
              ))}

              {!isOwner && canRejectLoan && (
                <div className="flex items-center gap-2">
                  {rejecting ? (
                    <>
                      <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason" className="h-8 w-48" />
                      <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => action("reject", `/api/circles/${circleId}/loans/${loanId}/reject`, { reason: rejectReason || undefined })} disabled={busy !== null}>
                        <XCircle className="size-4 mr-1" /> Reject
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setRejecting(false)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => setRejecting(true)}>
                      <XCircle className="size-4 mr-1" /> Reject
                    </Button>
                  )}
                </div>
              )}

              {canRecordDisbursement && (
                <div className="space-y-2 w-full">
                  {showDisbForm ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <Input type="number" value={disbAmount} onChange={(e) => setDisbAmount(e.target.value)} placeholder={loan.principal} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Method</Label>
                        <Input value={disbMethod} onChange={(e) => setDisbMethod(e.target.value)} placeholder="e.g. EFT" className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Reference</Label>
                        <Input value={disbReference} onChange={(e) => setDisbReference(e.target.value)} placeholder="Bank reference" className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Note (optional)</Label>
                        <Input value={disbNote} onChange={(e) => setDisbNote(e.target.value)} placeholder="Optional" className="h-8" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4">
                        <Label className="text-xs">Proof file (PDF, JPG, PNG, WebP, HEIC · max 5MB)</Label>
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic"
                          className="h-8 file:h-8 file:rounded-lg file:border-0 file:bg-muted file:px-2.5 file:text-sm"
                          onChange={(e) => setDisbFile(e.target.files?.[0] ?? null)}
                        />
                        {disbFile && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Selected: {disbFile.name} · {(disbFile.size / 1024).toFixed(0)} KB
                          </p>
                        )}
                      </div>
                      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                        <Button size="sm" className="rounded-xl" onClick={() => submitDisbursementProof()} disabled={busy !== null || !disbFile}>
                          <Banknote className="size-4 mr-1" /> Upload proof & record
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setShowDisbForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowDisbForm(true)}>
                      <Banknote className="size-4 mr-1" /> Record disbursement
                    </Button>
                  )}
                </div>
              )}

              {canConfirmDisbursement && !showDisbForm && (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="rounded-xl" onClick={() => action("confirm disbursement", `/api/circles/${circleId}/loans/${loanId}/disburse/confirm`)} disabled={busy !== null}>
                    <CheckCircle2 className="size-4 mr-1" /> Confirm disbursement
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => action("reject disbursement", `/api/circles/${circleId}/loans/${loanId}/disburse/reject`)} disabled={busy !== null}>
                    <XCircle className="size-4 mr-1" /> Reject
                  </Button>
                </div>
              )}

              {canMarkOverdue && (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => action("overdue", `/api/circles/${circleId}/loans/${loanId}/overdue`)} disabled={busy !== null}>
                  <Clock className="size-4 mr-1" /> Mark overdue
                </Button>
              )}

              {canMarkDefaulted && (
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => action("default", `/api/circles/${circleId}/loans/${loanId}/default`)} disabled={busy !== null}>
                  <FileWarning className="size-4 mr-1" /> Mark defaulted
                </Button>
              )}

              {loan.disbursement && loan.disbursement.proofs.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Disbursement proof</p>
                  <ProofPreview proof={loan.disbursement.proofs[loan.disbursement.proofs.length - 1]} />
                  <p className="text-xs text-muted-foreground">
                    {loan.disbursement.proofs.length} upload{loan.disbursement.proofs.length > 1 ? "s" : ""} · status {loan.disbursement.status}
                  </p>
                </div>
              )}

              {(canConfirmRepayment || canRejectRepayment) && awaitingRepayment && (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="rounded-xl" onClick={() => action("confirm repayment", `/api/circles/${circleId}/loans/${loanId}/repayments/${awaitingRepayment.id}/confirm`)} disabled={busy !== null}>
                    <CheckCircle2 className="size-4 mr-1" /> Confirm repayment ({symbol}{Number(awaitingRepayment.amount).toLocaleString()})
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => action("reject repayment", `/api/circles/${circleId}/loans/${loanId}/repayments/${awaitingRepayment.id}/reject`, { reason: "Repayment proof rejected" })} disabled={busy !== null}>
                    <XCircle className="size-4 mr-1" /> Reject repayment
                  </Button>
                </div>
              )}
            </div>

            {readOnlyAdmin && (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <Lock className="size-3.5 shrink-0" />
                Read-only — the next action requires another authorised member&apos;s permission.
              </div>
            )}

            {isOwner && (
              <p className="text-xs text-muted-foreground">
                You can&apos;t approve your own loan. Authorised members will review your application.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repayment submission */}
      {canSubmitRepayment && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Make a repayment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRepayForm ? (
              <div className="space-y-3">
                <div>
                  <Label>Repayment period</Label>
                  <select
                    value={repayScheduleId}
                    onChange={(e) => setRepayScheduleId(e.target.value)}
                    className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="">Select a period</option>
                    {loan.schedule.filter((s) => s.status !== "CONFIRMED").map((s) => (
                      <option key={s.id} value={s.id}>
                        Period {s.periodNumber} · {symbol}{Math.max(0, Number(s.totalDue) - Number(s.amountPaid)).toLocaleString()} · due {fmtDate(s.dueDate)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="repay-amount">Amount paid</Label>
                  <Input id="repay-amount" type="number" min={0} step="0.01" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} className="h-8" placeholder="e.g. 500" />
                </div>
                <div>
                  <Label htmlFor="repay-proof-file">
                    Proof file (PDF, JPG, PNG, WebP, HEIC · max 5MB)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="repay-proof-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic"
                      className="h-8 file:h-8 file:rounded-lg file:border-0 file:bg-muted file:px-2.5 file:text-sm"
                      onChange={(e) => setRepayFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {repayFile && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Selected: {repayFile.name} · {(repayFile.size / 1024).toFixed(0)} KB
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="repay-note">Note (optional)</Label>
                  <Input id="repay-note" value={repayNote} onChange={(e) => setRepayNote(e.target.value)} className="h-8" placeholder="Payment reference or note" />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="rounded-xl" disabled={busy !== null || !repayScheduleId || !Number(repayAmount) || !repayFile} onClick={() => submitRepaymentProof()}>
                    {busy === "submit repayment" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                    {repayFile ? (repayFile.name ? "Upload proof & submit" : "Submit repayment") : "Upload proof & submit"}
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setShowRepayForm(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="rounded-xl" onClick={() => setShowRepayForm(true)}>
                <Banknote className="size-4 mr-1" /> Submit repayment proof
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Upload a proof file (PDF or image) and your repayment will be reviewed and confirmed by the authorised members.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Member status read-only when no repayment is active */}
      {!isHighAccess && loan.status !== "REPAYING" && loan.status !== "OVERDUE" && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              {loan.status === "APPROVED" && "Your loan is approved and awaiting disbursement by an authorised member."}
              {loan.status === "SUBMITTED" && "Your application has been submitted and is awaiting review."}
              {loan.status === "UNDER_REVIEW" && "Your application is under review by the authorised members."}
              {loan.status === "REJECTED" && "Your application was not approved."}
              {loan.status === "DRAFT" && "This application is still a draft."}
              {loan.status === "DISBURSED" && "Your loan has been disbursed and is being confirmed."}
              {loan.status === "PAID_OFF" && "Congratulations — your loan is fully paid off."}
              {loan.status === "DEFAULTED" && "This loan has been defaulted. Contact the circle administrators."}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Repayment schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {loan.schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The repayment schedule will be generated once this loan is approved.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Due date</th>
                    <th className="py-2 pr-3 font-medium">Principal</th>
                    <th className="py-2 pr-3 font-medium">Interest</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Paid</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.map((s) => {
                    const isNext = nextSchedule?.id === s.id
                    return (
                      <tr key={s.id} className={`border-b border-border/40 last:border-0 ${isNext ? "bg-muted/30" : ""}`}>
                        <td className="py-2.5 pr-3 font-medium">{s.periodNumber}</td>
                        <td className="py-2.5 pr-3">{fmtDate(s.dueDate)}</td>
                        <td className="py-2.5 pr-3">{symbol}{Number(s.principalDue).toLocaleString()}</td>
                        <td className="py-2.5 pr-3">{symbol}{Number(s.interestDue).toLocaleString()}</td>
                        <td className="py-2.5 pr-3 font-semibold">{symbol}{Number(s.totalDue).toLocaleString()}</td>
                        <td className="py-2.5 pr-3">{symbol}{Number(s.amountPaid).toLocaleString()}</td>
                        <td className="py-2.5">
                          <Badge variant="outline" className={`text-[10px] ${s.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : s.status === "OVERDUE" ? "border-red-200 bg-red-50 text-red-700" : s.status === "PROOF_SUBMITTED" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                            {isNext ? <Clock className="size-3 mr-1" /> : null}
                            {SCHEDULE_STATUS_LABELS[s.status] ?? s.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repayment history */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Repayment history</CardTitle>
        </CardHeader>
        <CardContent>
          {loan.repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repayments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Confirmed by</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.repayments.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pr-3">{fmtDate(r.createdAt)}</td>
                      <td className="py-2.5 pr-3 font-semibold">{symbol}{Number(r.amount).toLocaleString()}</td>
                      <td className="py-2.5 pr-3">
                        {r.proofs.length > 0 ? (
                          <ProofPreview proof={r.proofs[r.proofs.length - 1]} />
                        ) : r.proofUrl ? (
                          <a href={r.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand underline">
                            {r.proofReference || "View"}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{r.proofReference || "—"}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className={`text-[10px] ${r.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : r.status === "REJECTED" ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
                          {REPAYMENT_STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="py-2.5">{r.status === "CONFIRMED" ? (r.confirmedByName ?? "—") : (isHighAccess && r.status === "PROOF_SUBMITTED" ? "Awaiting review" : "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
