"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, Send, MessageCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Link from "next/link"

export default function SupportPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("OTHER")
  const [sending, setSending] = useState(false)
  const [tickets, setTickets] = useState<any[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)

  useEffect(() => { fetch("/api/support/tickets?mine=true").then((r) => r.json()).then(setTickets).finally(() => setLoadingTickets(false)) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSending(true)
    try {
      const res = await fetch("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message, category }) })
      if (!res.ok) { toast.error("Failed to submit"); return }
      toast.success("Ticket submitted!"); setSubject(""); setMessage(""); router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Support</h1><p className="text-muted-foreground">Submit feedback, report bugs, or get help</p></div>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base"><MessageCircle className="size-4 inline mr-1" /> New Ticket</CardTitle></CardHeader><CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-xl" required />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue or feedback..." className="rounded-xl" rows={4} required />
          <Select value={category} onValueChange={(v: string | null) => { if (v) setCategory(v) }}>
            <SelectTrigger className="rounded-xl w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{["BUG","FEATURE_REQUEST","BILLING","ACCOUNT","CIRCLE","PAYMENT","WALLET","OTHER"].map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit" disabled={sending} className="rounded-xl bg-brand hover:bg-brand-600"><Send className="size-4 mr-1" /> {sending ? <Loader2 className="size-4 animate-spin" /> : "Submit Ticket"}</Button>
        </form>
      </CardContent></Card>

      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Your Tickets ({tickets.length})</CardTitle></CardHeader><CardContent>
        {loadingTickets ? <Loader2 className="size-4 animate-spin mx-auto" /> : tickets.length === 0 ? <p className="text-sm text-muted-foreground">No tickets yet</p> : (
          <div className="space-y-2">{tickets.map((t: any) => (
            <Link key={t.id} href={`/support/${t.id}`} className="flex items-center justify-between text-sm border-b pb-2 hover:bg-muted/30 -mx-2 px-2 rounded">
              <div><p className="font-medium">{t.subject}</p><p className="text-xs text-muted-foreground">{t.ticketNumber} · {new Date(t.createdAt).toLocaleDateString()}</p></div>
              <div className="flex items-center gap-2"><Badge variant="outline" className={t.status === "OPEN" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : t.status === "RESOLVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : "text-[10px]"}>{t.status}</Badge><ArrowRight className="size-3 text-muted-foreground" /></div>
            </Link>
          ))}</div>
        )}
      </CardContent></Card>
    </div>
  )
}
