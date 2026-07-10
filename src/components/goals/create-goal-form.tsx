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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createGoalSchema } from "@/lib/validations/goals"
import { toast } from "sonner"

export function CreateGoalForm({ circleId }: { circleId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createGoalSchema),
  })

  async function onSubmit(data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/circles/${circleId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to create goal")
        return
      }
      toast.success("Goal created!")
      reset()
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-xl bg-brand hover:bg-brand-600" />}>
        New Goal
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g. Vacation Fund"
              className="rounded-xl"
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-destructive">{String(errors.name.message)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-desc">Description (optional)</Label>
            <Input
              id="goal-desc"
              placeholder="What are you saving for?"
              className="rounded-xl"
              {...register("description")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target Amount</Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="rounded-xl"
                {...register("targetAmount")}
              />
              {errors.targetAmount && <p className="text-xs text-destructive">{String(errors.targetAmount.message)}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-deadline">
                Deadline <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="goal-deadline"
                type="date"
                className="rounded-xl"
                {...register("deadline")}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand hover:bg-brand-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
