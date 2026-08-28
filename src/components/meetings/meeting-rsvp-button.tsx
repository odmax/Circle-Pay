"use client"

import { useState } from "react"
import { Check, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface MeetingRsvpButtonProps {
  circleId: string
  meetingId: string
  current: string | null
}

const STATUSES = [
  { value: "GOING", label: "Going", icon: Check },
  { value: "MAYBE", label: "Maybe", icon: Clock },
  { value: "NOT_GOING", label: "Not going", icon: X },
]

export function MeetingRsvpButton({ circleId, meetingId, current }: MeetingRsvpButtonProps) {
  const [status, setStatus] = useState<string | null>(current)
  const [loading, setLoading] = useState(false)

  async function update(next: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/meetings/${meetingId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update RSVP")
      }
      setStatus(next)
      toast.success("RSVP updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update RSVP")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={status === value ? "default" : "outline"}
          size="sm"
          className="rounded-xl"
          disabled={loading}
          onClick={() => update(value)}
        >
          <Icon className="size-3.5 mr-1" /> {label}
        </Button>
      ))}
    </div>
  )
}
