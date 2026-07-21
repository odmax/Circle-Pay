"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { Loader2, Pencil } from "lucide-react"
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
import { toast } from "sonner"

interface Contribution {
  id: string
  amount: number
  status: string
  paymentDate: string
  note: string | null
  planId: string | null
}

export function EditContributionDialog({
  circleId,
  contribution,
  plans,
  currencySymbol,
  onSuccess,
}: {
  circleId: string
  contribution: Contribution
  plans: { id: string; name: string }[]
  currencySymbol: string
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const isConfirmed = contribution.status === "CONFIRMED"
  const isRejected = contribution.status === "REJECTED"

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      amount: contribution.amount,
      paymentDate: new Date(contribution.paymentDate).toISOString().split("T")[0],
      note: contribution.note || "",
      planId: contribution.planId || "",
      correctionReason: "",
    },
  })

  const selectedPlanId = watch("planId")

  async function onSubmit(formData: Record<string, unknown>) {
    const payload: Record<string, unknown> = {}
    const originalDate = new Date(contribution.paymentDate).toISOString().split("T")[0]

    if (isConfirmed) {
      if (formData.paymentDate !== originalDate) {
        payload.paymentDate = formData.paymentDate
      }
      if ((formData.note as string) !== (contribution.note || "")) {
        payload.note = formData.note || null
      }
      if (payload.paymentDate && !payload.correctionReason) {
        payload.correctionReason = formData.correctionReason || undefined
      }
    } else {
      if (Number(formData.amount) !== contribution.amount) payload.amount = formData.amount
      if (formData.paymentDate !== originalDate) payload.paymentDate = formData.paymentDate
      const newPlanId = (formData.planId as string) || null
      if (newPlanId !== contribution.planId) payload.planId = newPlanId
      if ((formData.note as string) !== (contribution.note || "")) payload.note = formData.note || null
      if (isRejected) {
        payload.status = "PENDING_REVIEW"
      }
    }

    if (Object.keys(payload).length === 0 || (Object.keys(payload).length === 1 && payload.correctionReason)) {
      toast.info("No changes made")
      setOpen(false)
      return
    }

    try {
      const res = await fetch(`/api/circles/${circleId}/contributions/${contribution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to update contribution")
        return
      }
      toast.success(isRejected ? "Contribution resubmitted for review!" : "Contribution updated!")
      setOpen(false)
      router.refresh()
      onSuccess?.()
    } catch {
      toast.error("Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" className="size-7" />}>
        <Pencil className="size-3.5" />
        <span className="sr-only">Edit</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Contribution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Plan (optional)</Label>
            <Select
              value={selectedPlanId || "none"}
              onValueChange={(v) => setValue("planId", v === "none" ? "" : v ?? "")}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
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

          {!isConfirmed && (
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount ({currencySymbol})</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="rounded-xl"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message as string}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-date">Payment Date</Label>
            <Input
              id="edit-date"
              type="date"
              className="rounded-xl"
              {...register("paymentDate")}
            />
          </div>

          {isConfirmed && (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                This contribution is confirmed. You can correct the date and note. All changes are
                audit-logged and will replace the existing receipt.
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reason">Correction reason *</Label>
                <Input
                  id="edit-reason"
                  placeholder="Why is this being corrected?"
                  className="rounded-xl"
                  {...register("correctionReason", { required: "Correction reason is required" })}
                />
                {errors.correctionReason && (
                  <p className="text-xs text-destructive">{errors.correctionReason.message as string}</p>
                )}
              </div>
            </>
          )}

          {isRejected && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              This contribution was rejected. Editing and saving will resubmit it for review as{" "}
              <strong>PENDING_REVIEW</strong>.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-note">Note (optional)</Label>
            <Input
              id="edit-note"
              placeholder="Reference or note"
              className="rounded-xl"
              {...register("note")}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand hover:bg-brand-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
