"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "SPECIAL", label: "Special" },
]

interface NewMeetingFormProps {
  circleId: string
}

export function NewMeetingForm({ circleId }: NewMeetingFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("GENERAL")
  const [status, setStatus] = useState("SCHEDULED")
  const [scheduledAt, setScheduledAt] = useState("")
  const [location, setLocation] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!scheduledAt) {
      toast.error("A scheduled time is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, type, status, scheduledAt: new Date(scheduledAt).toISOString(), location }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create meeting")
      }
      const meeting = await res.json()
      toast.success("Meeting created")
      router.push(`/circles/${circleId}/meetings/${meeting.id}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create meeting")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda or purpose" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULED">Scheduled (published)</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Scheduled time</Label>
        <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </div>
      <div>
        <Label>Location</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue or online link" />
      </div>
      <div className="text-xs text-muted-foreground">Scheduling is subject to the constitution notice period, if configured.</div>
      <Button type="submit" disabled={loading} className="rounded-xl">
        {loading ? "Creating…" : "Create Meeting"}
      </Button>
    </form>
  )
}
