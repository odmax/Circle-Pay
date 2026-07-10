"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function AcceptForm() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const [docs, setDocs] = useState<any[]>([])
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/legal/acceptance-status").then((r) => r.json()).then((d) => {
      setDocs(d.required || [])
      setAccepted(new Set((d.required || []).filter((r: any) => r.accepted).map((r: any) => r.slug)))
    }).finally(() => setLoading(false))
  }, [])

  async function handleAccept() {
    setSaving(true)
    try {
      const r = await fetch("/api/legal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: Array.from(accepted) }) })
      if (!r.ok) return
      const returnTo = params.get("returnTo") || "/dashboard"
      router.push(returnTo)
    } catch {}
    setSaving(false)
  }

  function toggle(slug: string) {
    const next = new Set(accepted)
    if (next.has(slug)) next.delete(slug); else next.add(slug)
    setAccepted(next)
  }

  if (status === "loading" || loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (status === "unauthenticated") { router.push("/login?callbackUrl=/legal/accept"); return null }
  if (docs.length === 0) { router.push("/dashboard"); return null }

  const allChecked = docs.every((d: any) => accepted.has(d.slug))

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 px-4">
      <div><h1 className="text-2xl font-bold tracking-tight">Legal Acceptance</h1><p className="text-muted-foreground mt-1">Please review and accept the following documents to continue using Circle Pay.</p></div>
      <Card className="rounded-2xl"><CardContent className="space-y-4 p-5">
        {docs.map((doc: any) => (
          <label key={doc.slug} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${accepted.has(doc.slug) ? "border-brand-200 bg-brand-50/20" : "border-border/40 hover:border-brand-100"}`}>
            <input type="checkbox" checked={accepted.has(doc.slug)} onChange={() => toggle(doc.slug)} className="mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Version {doc.version}{" "}
                <a href={`/legal/${doc.slug}`} target="_blank" className="text-brand hover:underline" onClick={(e) => e.stopPropagation()}>Read document</a>
              </p>
            </div>
            {accepted.has(doc.slug) && <Check className="size-4 text-brand mt-0.5 shrink-0" />}
          </label>
        ))}
      </CardContent></Card>
      <Button onClick={handleAccept} disabled={!allChecked || saving} className="w-full rounded-xl bg-brand hover:bg-brand-600 py-6">{saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}{allChecked ? "Continue to Dashboard" : "Accept All Required Documents"}</Button>
    </div>
  )
}

export default function LegalAcceptPage() {
  return <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}><AcceptForm /></Suspense>
}
