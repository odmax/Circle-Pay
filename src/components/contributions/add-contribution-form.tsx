"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
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
import {
  addContributionSchema,
} from "@/lib/validations/contributions"
import { toast } from "sonner"

export function AddContributionForm({
  circleId,
  members,
  plans,
  currencySymbol,
}: {
  circleId: string
  members: { id: string; name: string }[]
  plans: { id: string; name: string }[]
  currencySymbol: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addContributionSchema),
    defaultValues: {
      status: "PAID" as const,
      paymentDate: new Date().toISOString().split("T")[0],
    },
  })

  const selectedStatus = watch("status")

  async function onSubmit(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = { ...data }
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
        const err = await res.json()
        toast.error(err.error || "Failed to add contribution")
        return
      }
      toast.success("Contribution recorded!")
      reset()
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
        Record Payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Contribution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Member</Label>
            <Select
              onValueChange={(v) => { if (v) setValue("userId", v as string) }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.userId && (
              <p className="text-xs text-destructive">
                {errors.userId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Plan (optional)</Label>
            <Select
              onValueChange={(v) => { if (v) setValue("planId", v as string) }}
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
              <Label htmlFor="contrib-amount">
                Amount ({currencySymbol})
              </Label>
              <Input
                id="contrib-amount"
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
              <Label>Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(v) => {
                  if (v) setValue("status", v as "PAID" | "PENDING" | "CANCELLED")
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrib-date">Payment Date</Label>
            <Input
              id="contrib-date"
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

          <div className="space-y-2">
            <Label htmlFor="contrib-note">Note (optional)</Label>
            <Input
              id="contrib-note"
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
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
