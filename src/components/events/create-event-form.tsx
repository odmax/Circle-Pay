"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

const TYPE_LABELS: Record<string, string> = {
  MEETING: "Meeting",
  CONTRIBUTION_DAY: "Contribution Day",
  PAYOUT_DAY: "Payout Day",
  FUNDRAISER: "Fundraiser",
  TRIP: "Trip",
  CEREMONY: "Ceremony",
  GENERAL: "General",
}

export function CreateEventForm({ circleId }: { circleId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true)
    const form = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {}
    form.forEach((v, k) => {
      if (k === "amount") { if (v) data[k] = Number(v) }
      else data[k] = v
    })
    data.isOnline = form.get("isOnline") === "on"
    if (!data.endAt && form.get("endAt")) data.endAt = null
    if (!data.reminderDate) delete data.reminderDate

    try {
      const res = await fetch(`/api/circles/${circleId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Failed"); return }
      toast.success(data.status === "PUBLISHED" ? "Event published!" : "Event saved as draft")
      setOpen(false); router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-xl bg-brand hover:bg-brand-600" />}><Plus className="size-4 mr-1" /> New Event</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Title *</Label><Input name="title" required className="rounded-xl" placeholder="Investment review meeting" /></div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea name="description" className="rounded-xl" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Type</Label><Select name="type" defaultValue="MEETING"><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label><Select name="status" defaultValue="DRAFT"><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="PUBLISHED">Published</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Start *</Label><Input name="startAt" type="datetime-local" required className="rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs">End</Label><Input name="endAt" type="datetime-local" className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Location</Label><Input name="location" className="rounded-xl" placeholder="Office / Venue" /></div>
            <div className="space-y-1"><Label className="text-xs">Amount (ZAR)</Label><Input name="amount" type="number" className="rounded-xl" placeholder="500" /></div>
          </div>
          <div className="flex items-center justify-between"><Label className="text-xs">Online event</Label><Switch name="isOnline" /></div>
          <div className="space-y-1"><Label className="text-xs">Meeting Link</Label><Input name="meetingLink" className="rounded-xl" placeholder="https://meet.google.com/..." /></div>
          <div className="space-y-1"><Label className="text-xs">Reminder Date</Label><Input name="reminderDate" type="datetime-local" className="rounded-xl" /></div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="rounded-xl bg-brand hover:bg-brand-600">{saving ? <Loader2 className="size-4 animate-spin" /> : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
