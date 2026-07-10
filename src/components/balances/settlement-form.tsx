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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { createSettlementSchema } from "@/lib/validations/balances"
import { toast } from "sonner"

export function SettlementForm({
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
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(createSettlementSchema),
    defaultValues: { settlementDate: new Date().toISOString().split("T")[0] },
  })

  async function onSubmit(data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/circles/${circleId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to create settlement")
        return
      }
      toast.success("Settlement request created!")
      reset()
      setOpen(false)
      router.refresh()
    } catch { toast.error("Something went wrong") }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-xl bg-brand hover:bg-brand-600" />}>
        Record Settlement
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record Settlement</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>From (Debtor)</Label>
            <Select onValueChange={(v) => { if (v) setValue("debtorId", v as string) }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Who paid?" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To (Creditor)</Label>
            <Select onValueChange={(v) => { if (v) setValue("creditorId", v as string) }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Who received?" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="settle-amount">Amount ({currencySymbol})</Label>
              <Input id="settle-amount" type="number" step="0.01" placeholder="0.00" className="rounded-xl" {...register("amount")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settle-date">Date</Label>
              <Input id="settle-date" type="date" className="rounded-xl" {...register("settlementDate")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Input id="settle-note" placeholder="Payment reference" className="rounded-xl" {...register("note")} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand hover:bg-brand-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
