"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Upload, FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { addContributionSchema } from "@/lib/validations/contributions"
import { toast } from "sonner"

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "EFT", label: "EFT" },
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
]

export function SelfServiceContributionForm({
  circleId,
  plans,
  currencySymbol,
}: {
  circleId: string
  plans: { id: string; name: string }[]
  currencySymbol: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addContributionSchema),
    defaultValues: {
      status: "PENDING_REVIEW" as const,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "BANK_TRANSFER",
    },
  })

  function validateProof(file: File | null): string | null {
    if (!file) return "Proof of payment is required"
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
    if (!allowed.includes(file.type)) return "Proof must be JPG, PNG, WebP, HEIC, or PDF"
    if (file.size > 5 * 1024 * 1024) return "Proof must be 5MB or smaller"
    return null
  }

  async function onSubmit(data: Record<string, unknown>) {
    const err = validateProof(proofFile)
    if (err) {
      setProofError(err)
      return
    }
    setProofError(null)

    const payload: Record<string, unknown> = {
      ...data,
      status: "PENDING_REVIEW",
      contributionMonth: data.contributionMonth,
      paymentMethod: data.paymentMethod,
      proofReference: data.proofReference || "",
    }
    if (!payload.planId) delete payload.planId
    try {
      const res = await fetch(
        `/api/circles/${circleId}/contributions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const errBody = await res.json()
        toast.error(errBody.error || "Failed to submit contribution")
        return
      }
      const contribution = await res.json()

      if (proofFile) {
        const formData = new FormData()
        formData.append("file", proofFile)
        formData.append("contributionMonth", (data.contributionMonth as string) || "")
        formData.append("paymentMethod", (data.paymentMethod as string) || "")
        if (data.proofReference) formData.append("proofReference", data.proofReference as string)

        const upRes = await fetch(
          `/api/circles/${circleId}/contributions/${contribution.id}?action=upload-proof`,
          { method: "POST", body: formData }
        )
        if (!upRes.ok) {
          const upErr = await upRes.json()
          toast.error(`Contribution submitted but proof upload failed: ${upErr.error || "Unknown error"}`)
          return
        }

        const vRes = await fetch(
          `/api/circles/${circleId}/contributions/${contribution.id}?action=verify`,
          { method: "POST" }
        )
        if (vRes.ok) {
          const v = await vRes.json()
          if (v.status === "VERIFIED") toast.success("Contribution submitted and auto-verified!")
          else if (v.status === "NEEDS_REVIEW") toast.success("Contribution submitted — pending review")
          else toast.success("Contribution submitted! Proof uploaded for verification.")
        } else {
          toast.success("Contribution submitted! Proof uploaded for review.")
        }
      } else {
        toast.success("Contribution submitted for review!")
      }

      reset()
      setProofFile(null)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="rounded-xl bg-brand hover:bg-brand-600" />
        }
      >
        Submit Contribution
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Your Contribution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Plan (optional)</Label>
            <Select
              onValueChange={(v) => { if (v && v !== "none") setValue("planId", v as string) }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No plan</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="self-contrib-amount">
                Amount ({currencySymbol})
              </Label>
              <Input
                id="self-contrib-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="rounded-xl"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                onValueChange={(v) => { if (v) setValue("paymentMethod", v as string) }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paymentMethod && (
                <p className="text-xs text-destructive">
                  {errors.paymentMethod.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Contribution Month</Label>
              <Input
                type="month"
                className="rounded-xl"
                {...register("contributionMonth")}
              />
              {errors.contributionMonth && (
                <p className="text-xs text-destructive">
                  {errors.contributionMonth.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="self-contrib-date">Payment Date</Label>
              <Input
                id="self-contrib-date"
                type="date"
                className="rounded-xl"
                {...register("paymentDate")}
              />
              {errors.paymentDate && (
                <p className="text-xs text-destructive">
                  {errors.paymentDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="self-contrib-ref">Reference / Transaction ID (optional)</Label>
            <Input
              id="self-contrib-ref"
              placeholder="EFT reference number"
              className="rounded-xl"
              {...register("proofReference")}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium">
              Proof of Payment <span className="text-destructive">*</span>
            </Label>
            <label
              htmlFor="self-proof-upload"
              className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer hover:bg-muted/40 transition-colors"
            >
              {proofFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <FileText className="size-4 text-brand" />
                  <span className="font-medium text-foreground">{proofFile.name}</span>
                  <span className="text-muted-foreground">
                    ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload proof</span>
                  <span className="text-xs text-muted-foreground">
                    Bank receipt, EFT confirmation, or transaction statement
                  </span>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP, HEIC, PDF — max 5MB</span>
                </div>
              )}
              <input
                id="self-proof-upload"
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setProofFile(f)
                  setProofError(validateProof(f))
                }}
              />
            </label>
            {proofError && (
              <p className="text-xs text-destructive">{proofError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="self-contrib-note">Note (optional)</Label>
            <Input
              id="self-contrib-note"
              placeholder="Reference or note"
              className="rounded-xl"
              {...register("note")}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-brand hover:bg-brand-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Contribution"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
