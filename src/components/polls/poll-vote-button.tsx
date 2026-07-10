"use client"

import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function PollVoteButton({ circleId, pollId, optionId, selected }: { circleId: string; pollId: string; optionId: string; selected: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function vote() {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/polls/${pollId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "vote", optionId }),
      })
      if (!res.ok) { toast.error("Failed"); return }
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setLoading(false) }
  }

  return (
    <Button size="icon" variant={selected ? "default" : "outline"} className={`size-6 rounded-full shrink-0 ${selected ? "bg-brand hover:bg-brand-600" : ""}`} onClick={vote} disabled={loading || selected}>
      {loading ? <Loader2 className="size-3 animate-spin" /> : selected ? <Check className="size-3" /> : null}
    </Button>
  )
}
