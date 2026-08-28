"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Landmark,
  Loader2,
  Info,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface LoanApplyClientProps {
  circleId: string
  userId: string
  symbol: string
  canApply: boolean
}

interface LoanConfig {
  enabled: boolean
  minLoanAmount: string | null
  maxLoanAmount: string | null
  maxTotalLoansOutstanding: string | null
  maxActiveLoansPerMember: number | null
  interestRate: string
  serviceFeePercent: string
  maxRepaymentTermMonths: number | null
  defaultRepaymentFrequency: string
  gracePeriodDays: number | null
  lateFeePercent: string | null
  allowsMemberInitiated: boolean
  requiresApproval: boolean
  autoConfirmRepayments: boolean
}

const FREQ_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
]

export function LoanApplyClient({ circleId, symbol, canApply }: LoanApplyClientProps) {
  const router = useRouter()
  const [config, setConfig] = useState<LoanConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)

  const [principal, setPrincipal] = useState("")
  const [termMonths, setTermMonths] = useState("")
  const [frequency, setFrequency] = useState("MONTHLY")
  const [purpose, setPurpose] = useState("")

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/circles/${circleId}/loan-config`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load loan settings")
        if (mounted) {
          setConfig(data.config ?? null)
          if (data.config?.defaultRepaymentFrequency) {
            setFrequency(data.config.defaultRepaymentFrequency)
          }
        }
      } catch (e) {
        if (mounted) setLoadError(e instanceof Error ? e.message : "Failed to load loan settings")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [circleId])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (loadError) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertCircle className="size-8 text-red-500" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" className="rounded-xl" render={<Link href={`/circles/${circleId}/loans`} />}>
            <ArrowLeft className="size-4 mr-1" /> Back to loans
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!canApply) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Landmark className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to apply for a loan in this circle.
          </p>
          <Button variant="outline" size="sm" className="rounded-xl" render={<Link href={`/circles/${circleId}/loans`} />}>
            <ArrowLeft className="size-4 mr-1" /> Back to loans
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (successId) {
    return (
      <Card className="rounded-2xl border-emerald-200">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-10 text-emerald-500" />
          <h2 className="text-lg font-semibold">Application submitted</h2>
          <p className="text-sm text-muted-foreground">
            {config?.requiresApproval
              ? "Your loan application has been submitted for review by the authorised members."
              : "Your loan application has been submitted."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-xl" render={<Link href={`/circles/${circleId}/loans/${successId}`} />}>
              View application
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" render={<Link href={`/circles/${circleId}/loans`} />}>
              Back to loans
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const notEnabled = !!config && config.enabled === false
  const maxTerm = config?.maxRepaymentTermMonths ?? 12

  const submit = async () => {
    const amount = Number(principal)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid loan amount")
      return
    }
    const term = Number(termMonths)
    if (!term || term < 1) {
      toast.error("Enter a valid term in months")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/loans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principal: amount,
          termMonths: term,
          repaymentFrequency: frequency,
          purpose: purpose.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit application")
      setSuccessId(data.loan?.id ?? null)
      toast.success("Loan application submitted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit application")
    } finally {
      setSubmitting(false)
    }
  }

  const interestPct = config ? Number(config.interestRate) * 100 : 0
  const serviceFeePct = config ? Number(config.serviceFeePercent) : 0
  const estInterest = amountInterest(Number(principal), interestPct)
  const estFee = amountFee(Number(principal), serviceFeePct)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="rounded-2xl border-border/40 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Loan details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notEnabled && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>Loans are currently disabled for this circle. Your request can only be submitted if an authorised member enables them.</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loan-amount">Loan amount</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{symbol}</span>
              <Input
                id="loan-amount"
                type="number"
                min={0}
                step="0.01"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            {config?.minLoanAmount != null && config.maxLoanAmount != null && (
              <p className="text-xs text-muted-foreground">
                {symbol}{Number(config.minLoanAmount).toLocaleString()} – {symbol}{Number(config.maxLoanAmount).toLocaleString()} allowed
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="loan-term">Repayment term (months)</Label>
            <Input
              id="loan-term"
              type="number"
              min={1}
              max={maxTerm}
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              placeholder={`Up to ${maxTerm} months`}
            />
          </div>

          <div className="space-y-2">
            <Label>Repayment frequency</Label>
            <Select value={frequency} onValueChange={(v) => v && setFrequency(v)}>
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQ_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loan-purpose">Purpose (optional)</Label>
            <Textarea
              id="loan-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Briefly describe the purpose of the loan"
              rows={3}
            />
          </div>

          <Button onClick={submit} disabled={submitting || notEnabled} className="rounded-xl">
            {submitting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Landmark className="size-4 mr-1" />}
            Submit application
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Cost estimate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Interest rate</p>
              <p className="font-semibold">{interestPct.toLocaleString()}% per period</p>
            </div>
            {serviceFeePct > 0 && (
              <div>
                <p className="text-muted-foreground">Service fee</p>
                <p className="font-semibold">{serviceFeePct}%</p>
              </div>
            )}
            {principal ? (
              <>
                <div className="border-t border-border/60 pt-3">
                  <p className="text-muted-foreground text-xs">Estimated interest</p>
                  <p className="font-semibold">{symbol}{estInterest.toLocaleString()}</p>
                </div>
                {serviceFeePct > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs">Estimated fee</p>
                    <p className="font-semibold">{symbol}{estFee.toLocaleString()}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Enter an amount to see the cost estimate.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0" />
          <span>
            {config?.requiresApproval
              ? "Your application will be reviewed and approved by the authorised members before any funds are disbursed."
              : "Your application is processed without a separate approval step."}
            {config?.autoConfirmRepayments ? " Repayments are auto-confirmed on submission." : " Repayments require confirmation once proof of payment is submitted."}
          </span>
        </div>
      </div>
    </div>
  )
}

function amountInterest(principal: number, interestPct: number) {
  return principal * (interestPct / 100)
}

function amountFee(principal: number, serviceFeePct: number) {
  return principal * (serviceFeePct / 100)
}
