"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
  const isImmutable = contribution.status === "CONFIRMED" || contribution.status === "REJECTED"

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
    },
  })

  const selectedPlanId = watch("planId")

  async function onSubmit(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {}
    if (!isImmutable) {
      if (Number(data.amount) !== contribution.amount) payload.amount = data.amount
      if (data.paymentDate !== new Date(contribution.paymentDate).toISOString().split("T")[0]) {
        payload.paymentDate = data.paymentDate
      }
    }
    const newPlanId = (data.planId as string) || null
    if (newPlanId !== contribution.planId) payload.planId = newPlanId
    if ((data.note as string) !== (contribution.note || "")) payload.note = data.note || null

    if (Object.keys(payload).length === 0) {
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
      toast.success("Contribution updated!")
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

          {!isImmutable && (
            <>
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

              <div className="space-y-2">
                <Label htmlFor="edit-date">Payment Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  className="rounded-xl"
                  {...register("paymentDate")}
                />
              </div>
            </>
          )}

          {isImmutable && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              This contribution is {contribution.status.toLowerCase()}. Amount and date cannot be changed.{" "}
              <strong>Void it first</strong> to modify financial details.
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
