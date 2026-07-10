"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Loader2, Users, MapPin, Shield, Globe, CheckCircle, Clock, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function JoinByCodePage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/invites/${inviteCode}`).then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }, [inviteCode])

  async function handleJoin() {
    setJoining(true)
    try {
      const r = await fetch(`/api/invites/${inviteCode}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: Object.keys(answers).length > 0 ? answers : undefined }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed to join") }
      else if (d.status === "joined") { setResult("joined"); toast.success("Successfully joined!"); setTimeout(() => router.push(`/circles/${(data as any)?.circle?.id}`), 1500) }
      else if (d.status === "request_sent") { setResult("request_sent"); toast.success("Join request submitted!") }
      else if (d.status === "already_member") { setResult("already_member"); router.push(`/circles/${((data as any)?.circle as any)?.id}`) }
    } catch { toast.error("Failed") }
    setJoining(false)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

  const d = data as any
  const circle = d?.circle as { id: string; name: string; type: string; visibility: string; verification: string; memberCount: number; country: string; city: string; joinApprovalRequired: boolean; publicDescription: string; owner: { name: string }; rules?: string } | undefined
  const valid = d?.valid as boolean
  const questions = (d?.circle?.joinQuestions as string[]) || []

  if (!circle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted"><Globe className="size-8 text-muted-foreground/40" /></div>
        <h1 className="text-2xl font-bold tracking-tight">Invalid Code</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((data as any)?.reason || "") || "This invite code is invalid or has expired."}</p>
        <Button render={<Link href="/join" />} className="mt-4 rounded-xl bg-brand hover:bg-brand-600">Try Another Code</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 px-4">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="size-4 text-brand" /> Circle Preview</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 text-xl font-bold">{(circle.name as string)?.[0] || "C"}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{circle.name as string}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px]">{circle.type as string}</Badge>
              <Badge variant="outline" className="text-[10px]">{circle.visibility as string}</Badge>
              {circle.verification === "VERIFIED" && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"><CheckCircle className="size-3 mr-0.5" /> Verified</Badge>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> <span>{circle.memberCount as number} members</span></div>
          <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" /> <span>{(circle.country as string) || "—"}{(circle.city as string) ? `, ${circle.city}` : ""}</span></div>
          <div className="flex items-center gap-1.5 text-muted-foreground"><Shield className="size-3.5" /> <span>{circle.joinApprovalRequired ? "Approval required" : "Instant join"}</span></div>
          {(circle.owner as Record<string, string>)?.name && <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> <span>Owned by {(circle.owner as Record<string, string>).name}</span></div>}
        </div>
        {circle.publicDescription && <p className="text-sm text-muted-foreground border-t pt-3">{circle.publicDescription as string}</p>}
      </CardContent></Card>

      {/* Join Questions */}
      {!result && status === "authenticated" && valid && circle.joinApprovalRequired && questions.length > 0 && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="size-4" /> Questions</CardTitle></CardHeader><CardContent className="space-y-3">
          {questions.map((q: string, i: number) => (
            <div key={i}><p className="text-sm font-medium mb-1">{q}</p><Input value={answers[q] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))} placeholder="Your answer..." className="rounded-xl" maxLength={500} /></div>
          ))}
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {result === "joined" && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 text-center"><CheckCircle className="size-6 text-emerald-600 mx-auto mb-1" /><p className="font-semibold text-emerald-700">Joined!</p><p className="text-xs text-emerald-600 mt-1">Redirecting you to the circle...</p></div>}
        {result === "request_sent" && <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 text-center"><Clock className="size-6 text-amber-600 mx-auto mb-1" /><p className="font-semibold text-amber-700">Request Submitted</p><p className="text-xs text-amber-600 mt-1">Circle admins will review your request.</p></div>}

        {!result && status === "unauthenticated" && (
          <div className="space-y-3"><p className="text-sm text-muted-foreground text-center">Sign in to join this circle.</p><Button render={<Link href={`/login?callbackUrl=/join/${inviteCode}`} />} className="w-full rounded-xl bg-brand hover:bg-brand-600">Sign In to Join</Button></div>
        )}

        {!result && status === "authenticated" && valid && (
          <Button onClick={handleJoin} disabled={joining} className="w-full rounded-xl bg-brand hover:bg-brand-600 text-base py-6">{joining ? <Loader2 className="size-4 animate-spin mr-1" /> : null}{circle.joinApprovalRequired ? "Request to Join" : "Join Circle"}</Button>
        )}
      </div>
    </div>
  )
}
