"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function JoinCircleDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("")
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    try {
      const r = await fetch(`/api/invites/${trimmed}`)
      const d = await r.json()
      if (!d.circle) { setError("Invalid invite code"); return }
      router.push(`/join/${trimmed}`)
    } catch { setError("Failed to check code") }
    setLoading(false)
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
          <div className="bg-card border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Join a Circle</h2>
            <p className="text-sm text-muted-foreground">Enter an invite code to join a circle.</p>
            <form onSubmit={handleSubmit}>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Invite code" className="rounded-xl text-center font-mono text-lg tracking-widest" maxLength={12} autoFocus />
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              <Button type="submit" disabled={loading || !code.trim()} className="w-full mt-3 rounded-xl bg-brand hover:bg-brand-600">{loading ? <Loader2 className="size-4 animate-spin" /> : "Join"}</Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
