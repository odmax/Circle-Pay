"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function CreateFeedPost({ circleId }: { circleId: string }) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!content.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/feed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) })
      if (!res.ok) { toast.error("Failed"); return }
      setContent("")
      toast.success("Posted!")
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSending(false) }
  }

  return (
    <div className="flex gap-3 items-start rounded-2xl border border-border/40 bg-card p-4">
      <Textarea placeholder="Share something with your circle..." value={content} onChange={(e) => setContent(e.target.value)} className="flex-1 rounded-xl min-h-[60px] resize-none" />
      <Button size="icon" className="rounded-xl bg-brand hover:bg-brand-600 shrink-0" onClick={handleSend} disabled={sending || !content.trim()}>
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </div>
  )
}
