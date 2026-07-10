"use client"

import { useRouter } from "next/navigation"
import { Check, HelpCircle, X, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function EventRSVPActions({ circleId, eventId, currentStatus }: { circleId: string; eventId: string; currentStatus?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function rsvp(status: string) {
    setLoading(status)
    try {
      const res = await fetch(`/api/circles/${circleId}/events/${eventId}/rsvp`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      })
      if (!res.ok) { toast.error("Failed"); return }
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setLoading(null) }
  }

  const selected = (s: string) => currentStatus === s ? "bg-brand text-white hover:bg-brand-600" : ""

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className={`h-7 rounded-lg text-xs ${selected("GOING")}`} disabled={!!loading} onClick={() => rsvp("GOING")}>
        {loading === "GOING" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Going
      </Button>
      <Button size="sm" variant="outline" className={`h-7 rounded-lg text-xs ${selected("MAYBE")}`} disabled={!!loading} onClick={() => rsvp("MAYBE")}>
        {loading === "MAYBE" ? <Loader2 className="size-3 animate-spin" /> : <HelpCircle className="size-3" />} Maybe
      </Button>
      <Button size="sm" variant="outline" className={`h-7 rounded-lg text-xs ${selected("NOT_GOING")}`} disabled={!!loading} onClick={() => rsvp("NOT_GOING")}>
        {loading === "NOT_GOING" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />} No
      </Button>
    </div>
  )
}
