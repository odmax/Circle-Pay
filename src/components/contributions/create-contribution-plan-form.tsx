"use client"

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
import { useState } from "react"
import {
  createContributionPlanSchema,
} from "@/lib/validations/contributions"
import { toast } from "sonner"

export function CreateContributionPlanForm({ circleId }: { circleId: string }) {
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
    resolver: zodResolver(createContributionPlanSchema),
    defaultValues: {
      frequency: "MONTHLY" as const,
      startDate: new Date().toISOString().split("T")[0],
    },
  })

  const selectedFrequency = watch("frequency")

  async function onSubmit(data: Record<string, unknown>) {
    try {
      const res = await fetch(
        `/api/circles/${circleId}/contribution-plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to create plan")
        return
      }
      toast.success("Contribution plan created!")
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
          <Button
            variant="outline"
            className="rounded-xl"
          />
        }
      >
        Create Plan
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Contribution Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan Name</Label>
            <Input
              id="plan-name"
              placeholder="e.g. Monthly Savings"
              className="rounded-xl"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-desc">Description (optional)</Label>
            <Input
              id="plan-desc"
              placeholder="What is this plan for?"
              className="rounded-xl"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="plan-amount">Amount</Label>
              <Input
                id="plan-amount"
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
              <Label>Frequency</Label>
              <Select
                value={selectedFrequency}
                onValueChange={(v) => {
                  if (v) setValue("frequency", v as "WEEKLY" | "MONTHLY" | "ONCE_OFF" | "CUSTOM")
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="ONCE_OFF">Once-off</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
              {errors.frequency && (
                <p className="text-xs text-destructive">
                  {errors.frequency.message}
                </p>
              )}
            </div>
          </div>

          {selectedFrequency !== "ONCE_OFF" && (
            <div className="space-y-2">
              <Label htmlFor="plan-due-day">
                Due Day{" "}
                <span className="text-muted-foreground">
                  ({selectedFrequency === "WEEKLY" ? "1-7" : "1-31"})
                </span>
              </Label>
              <Input
                id="plan-due-day"
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 1"
                className="rounded-xl"
                {...register("dueDay")}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="plan-start">Start Date</Label>
              <Input
                id="plan-start"
                type="date"
                className="rounded-xl"
                {...register("startDate")}
              />
              {errors.startDate && (
                <p className="text-xs text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-end">
                End Date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="plan-end"
                type="date"
                className="rounded-xl"
                {...register("endDate")}
              />
            </div>
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
                "Create Plan"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
