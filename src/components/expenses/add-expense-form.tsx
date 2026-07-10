"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createExpenseSchema } from "@/lib/validations/expenses"
import { toast } from "sonner"

export function AddExpenseForm({
  circleId,
  members,
  currencySymbol,
}: {
  circleId: string
  members: { id: string; name: string }[]
  currencySymbol: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      splitType: "EQUAL" as const,
      category: "other" as const,
      expenseDate: new Date().toISOString().split("T")[0],
      splits: [{ userId: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "splits" })
  const splitType = watch("splitType")

  async function onSubmit(data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/circles/${circleId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to add expense")
        return
      }
      toast.success("Expense recorded!")
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
        Add Expense
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exp-title">Title</Label>
              <Input id="exp-title" placeholder="e.g. Groceries" className="rounded-xl" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{String(errors.title.message)}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Amount ({currencySymbol})</Label>
              <Input id="exp-amount" type="number" step="0.01" placeholder="0.00" className="rounded-xl" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{String(errors.amount.message)}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select defaultValue="other" onValueChange={(v) => { if (v) setValue("category", v as "groceries" | "rent" | "utilities" | "transport" | "food" | "travel" | "event" | "family" | "church" | "other") }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["groceries","rent","utilities","transport","food","travel","event","family","church","other"].map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Split Type</Label>
              <Select value={splitType as string} onValueChange={(v) => { if (v) setValue("splitType", v as "EQUAL"|"EXACT"|"PERCENTAGE") }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EQUAL">Equal</SelectItem>
                  <SelectItem value="EXACT">Exact</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">Date</Label>
              <Input id="exp-date" type="date" className="rounded-xl" {...register("expenseDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Paid By</Label>
            <Select onValueChange={(v) => { if (v) setValue("paidById", v as string) }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select payer" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.paidById && <p className="text-xs text-destructive">{String(errors.paidById.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-notes">Notes (optional)</Label>
            <Input id="exp-notes" placeholder="Optional notes" className="rounded-xl" {...register("notes")} />
          </div>

          {/* Splits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Split Among</Label>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => append({ userId: "" })}>
                <Plus className="size-3 mr-1" /> Add
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-center gap-2">
                <Select onValueChange={(v) => { if (v) setValue(`splits.${i}.userId`, v as string) }}>
                  <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Member" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {splitType === "EXACT" && (
                  <Input type="number" step="0.01" placeholder="0.00" className="w-24 rounded-xl" {...register(`splits.${i}.amount`)} />
                )}
                {splitType === "PERCENTAGE" && (
                  <Input type="number" min={0} max={100} placeholder="%" className="w-20 rounded-xl" {...register(`splits.${i}.percentage`)} />
                )}
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => remove(i)}>
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ))}
            {errors.splits && <p className="text-xs text-destructive">{String(errors.splits.message || errors.splits.root?.message)}</p>}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand hover:bg-brand-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Save Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
