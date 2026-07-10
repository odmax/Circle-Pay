"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function RequestJoinButton({ circleId }: { circleId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRequest() {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Failed to send request"); return }
      toast.success("Join request sent!")
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setLoading(false) }
  }

  return (
    <Button variant="outline" size="sm" className="rounded-xl" onClick={handleRequest} disabled={loading}>
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
      <span className="ml-1">Request</span>
    </Button>
  )
}
