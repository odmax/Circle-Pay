"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FeedLoadMore({ circleId, cursor }: { circleId: string; cursor: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    router.push(`/circles/${circleId}/feed?cursor=${cursor}`)
  }

  return (
    <div className="flex justify-center pt-2">
      <Button variant="outline" className="rounded-xl" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Load more posts"}
      </Button>
    </div>
  )
}
