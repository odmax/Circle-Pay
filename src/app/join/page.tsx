"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function JoinPage() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    router.push(`/join/${trimmed.toUpperCase()}`)
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Globe className="size-8" /></div>
      <h1 className="text-2xl font-bold tracking-tight">Join a Circle</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">Enter an invite code to join a savings group, stokvel, or community circle.</p>
      <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-sm gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter invite code" className="rounded-xl text-center font-mono text-lg tracking-wider" maxLength={12} autoFocus />
        <Button type="submit" disabled={!code.trim()} className="rounded-xl bg-brand hover:bg-brand-600">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}</Button>
      </form>
    </div>
  )
}
