"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { z } from "zod"
import { toast } from "sonner"

const schema = z.object({
  name: z.string().max(80).optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be positive"),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]),
  firstDueDate: z.string().min(1, "First due date is required"),
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable().or(z.literal("")),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).default(0),
  lateFee: z.coerce.number().min(0).optional().nullable().or(z.literal("")),
})

const FREQUENCIES: { value: string; label: string }[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUALLY", label: "Annually" },
  { value: "CUSTOM", label: "Custom (30 days)" },
]

export function CreateContributionScheduleForm({
  circleId,
  currencySymbol,
}: {
  circleId: string
  currencySymbol: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [autoGenerate, setAutoGenerate] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      frequency: "MONTHLY",
      firstDueDate: new Date().toISOString().split("T")[0],
      gracePeriodDays: 3,
    },
  })

  async function onSubmit(data: Record<string, unknown>) {
    try {
      const payload: Record<string, unknown> = { ...data, autoGenerate }
      if (!payload.dueDay) delete payload.dueDay
      if (payload.lateFee === "" || payload.lateFee == null) delete payload.lateFee
      const res = await fetch(`/api/circles/${circleId}/contribution-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to create schedule")
        return
      }
      toast.success("Schedule created — future contributions will auto-generate")
      reset()
      setAutoGenerate(true)
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
          <Button variant="outline" className="rounded-xl" />
        }
      >
        New Schedule
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Contribution Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sched-name">Name (optional)</Label>
            <Input
              id="sched-name"
              placeholder="e.g. Monthly Savings"
              className="rounded-xl"
              {...register("name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sched-amount">Amount ({currencySymbol})</Label>
              <Input
                id="sched-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="rounded-xl"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                onValueChange={(v) => { if (v) setValue("frequency", v as any) }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.frequency && (
                <p className="text-xs text-destructive">{errors.frequency.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sched-first-due">First Due Date</Label>
              <Input
                id="sched-first-due"
                type="date"
                className="rounded-xl"
                {...register("firstDueDate")}
              />
              {errors.firstDueDate && (
                <p className="text-xs text-destructive">{errors.firstDueDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-due-day">Due Day (1-31)</Label>
              <Input
                id="sched-due-day"
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 15"
                className="rounded-xl"
                {...register("dueDay")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sched-grace">Grace Period (days)</Label>
              <Input
                id="sched-grace"
                type="number"
                min={0}
                max={365}
                className="rounded-xl"
                {...register("gracePeriodDays")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-late-fee">Late Fee ({currencySymbol}, optional)</Label>
              <Input
                id="sched-late-fee"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="rounded-xl"
                {...register("lateFee")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
            <div>
              <Label className="font-medium">Auto-generate contributions</Label>
              <p className="text-xs text-muted-foreground">
                Automatically create contribution records for every member each period
              </p>
            </div>
            <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand hover:bg-brand-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
