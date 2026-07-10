import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getPayoutSchedule, getPoolCompliance, generateRotationSchedule } from "@/lib/services/payout-cycle.service"
import { CURRENCIES } from "@/lib/constants"

export default async function PayoutsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, schedule, compliance
  try {
    [circle, schedule, compliance] = await Promise.all([getCircleById(circleId, session.user.id), getPayoutSchedule(circleId), getPoolCompliance(circleId)])
  } catch { notFound() }

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency

  if (schedule.length === 0) {
    try { await generateRotationSchedule(circleId); redirect(`/circles/${circleId}/payouts`) } catch {}
  }

  const next = schedule.find((c) => c.status === "UPCOMING" || c.status === "READY")
  const completed = schedule.filter((c) => c.status === "COMPLETED")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Payout Schedule</h1><p className="text-muted-foreground">{circle.name}</p></div>
      </div>

      {/* Compliance */}
      {compliance.expectedTotal > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Pool Required</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{symbol}{compliance.expectedTotal.toLocaleString()}</div></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Collected</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-emerald-600">{symbol}{compliance.collected.toLocaleString()}</div></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Shortfall</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${compliance.shortfall <= 0 ? "text-emerald-600" : "text-amber-600"}`}>{symbol}{Math.max(0, compliance.shortfall).toLocaleString()}</div></CardContent></Card>
        </div>
      )}

      {/* Next Payout */}
      {next && (
        <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
          <CardHeader><CardTitle className="text-base text-brand-800">Next Payout</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="size-12"><AvatarImage src={next.recipient.image || ""} /><AvatarFallback className="text-lg">{next.recipient.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}</AvatarFallback></Avatar>
              <div>
                <p className="font-bold text-lg">{next.recipient.name || next.recipient.email}</p>
                <p className="text-2xl font-bold text-brand mt-1">{symbol}{Number(next.amount).toLocaleString()}</p>
                {next.dueDate && <p className="text-xs text-muted-foreground mt-1">Due: {new Date(next.dueDate).toLocaleDateString()}</p>}
              </div>
              <div className="ml-auto"><Badge className="bg-brand text-white">Cycle #{next.cycleNumber}</Badge></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Rotation Schedule</CardTitle></CardHeader><CardContent>
        <div className="space-y-2">
          {schedule.map((p) => {
            const init = p.recipient.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
            const statusColors: Record<string, string> = { COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700", UPCOMING: "border-amber-200 bg-amber-50 text-amber-700", READY: "border-brand-200 bg-brand-50 text-brand-700", SKIPPED: "border-slate-200 bg-slate-50 text-slate-500", CANCELLED: "border-red-200 bg-red-50 text-red-700" }
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                <Badge variant="outline" className="w-16 justify-center text-xs">#{p.cycleNumber}</Badge>
                <Avatar className="size-8"><AvatarImage src={p.recipient.image || ""} /><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.recipient.name || p.recipient.email}</p></div>
                <span className="font-mono font-bold text-sm">{symbol}{Number(p.amount).toLocaleString()}</span>
                <Badge variant="outline" className={statusColors[p.status] || ""}>{p.status}</Badge>
              </div>
            )
          })}
        </div>
      </CardContent></Card>
    </div>
  )
}
