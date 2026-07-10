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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { allocateGoalSchema } from "@/lib/validations/goals"
import { toast } from "sonner"

export function AllocateGoalForm({
  circleId,
  goalId,
  members,
  currencySymbol,
}: {
  circleId: string
  goalId: string
  members: { id: string; name: string }[]
  currencySymbol: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(allocateGoalSchema),
    defaultValues: {
      allocationDate: new Date().toISOString().split("T")[0],
    },
  })

  async function onSubmit(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = { ...data }
    if (!payload.contributionId) delete payload.contributionId
    try {
      const res = await fetch(
        `/api/circles/${circleId}/goals/${goalId}/allocations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to allocate")
        return
      }
      toast.success("Allocation recorded!")
      reset()
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="rounded-xl" />}>
        Allocate
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate to Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Member</Label>
            <Select onValueChange={(v) => { if (v) setValue("userId", v as string) }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.userId && <p className="text-xs text-destructive">{String(errors.userId.message)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc-amount">Amount ({currencySymbol})</Label>
            <Input
              id="alloc-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="rounded-xl"
              {...register("amount")}
            />
            {errors.amount && <p className="text-xs text-destructive">{String(errors.amount.message)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc-date">Allocation Date</Label>
            <Input
              id="alloc-date"
              type="date"
              className="rounded-xl"
              {...register("allocationDate")}
            />
            {errors.allocationDate && <p className="text-xs text-destructive">{String(errors.allocationDate.message)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc-note">Note (optional)</Label>
            <Input
              id="alloc-note"
              placeholder="e.g. Monthly contribution"
              className="rounded-xl"
              {...register("note")}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand hover:bg-brand-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Allocate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
