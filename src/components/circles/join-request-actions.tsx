"use client"

import { useRouter } from "next/navigation"
import { Check, X, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function JoinRequestActions({ circleId, requestId }: { circleId: string; requestId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)

  async function act(action: "approve" | "reject") {
    setLoading(action)
    const res = await fetch(`/api/circles/${circleId}/join-requests/${requestId}/${action}`, { method: "POST" })
    if (!res.ok) { toast.error("Failed"); setLoading(null); return }
    toast.success(action === "approve" ? "Approved!" : "Rejected")
    router.refresh()
  }

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-8 rounded-lg text-emerald-600" disabled={!!loading} onClick={() => act("approve")}>
        {loading === "approve" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      </Button>
      <Button size="sm" variant="outline" className="h-8 rounded-lg text-red-600" disabled={!!loading} onClick={() => act("reject")}>
        {loading === "reject" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
      </Button>
    </div>
  )
}
