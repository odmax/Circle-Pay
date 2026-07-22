import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle, Clock, Upload, FileText, Plus, AlertCircle } from "lucide-react"
import { revalidatePath } from "next/cache"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCirclePaymentIntents, getUserPaymentIntents } from "@/lib/services/circle-payment.service"
import { CURRENCIES } from "@/lib/constants"

export default async function PaymentsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle: any, userPayments: any[] = [], allPayments: any[] = [], pageError: string | null = null
  try {
    ;[circle, userPayments, allPayments] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getUserPaymentIntents(session.user.id, circleId),
      getCirclePaymentIntents(circleId),
    ])
  } catch (e) {
    pageError = (e as Error).message
    console.error("Payments page error:", e)
  }
  if (pageError || !circle) {
    return (<div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Payments</h1></div>
      </div>
      <Card className="rounded-2xl border-amber-200 bg-amber-50/20"><CardContent className="flex items-start gap-3 p-4"><AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" /><div><p className="font-medium text-amber-800">Could not load payments</p><p className="text-xs text-amber-700 mt-1">{pageError || "Missing data"}</p></div></CardContent></Card>
    </div>)
  }
  const isAdmin = circle.userRole === "OWNER" || circle.userRole === "ADMIN"
  const symbol = CURRENCIES.find((c) => c.code === circle.currency)?.symbol || circle.currency

  const statusBadge = (s: string) => ({ PENDING: "border-slate-200 bg-slate-50 text-slate-600", PROOF_SUBMITTED: "border-amber-200 bg-amber-50 text-amber-700", CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700", REJECTED: "border-red-200 bg-red-50 text-red-700", OVERDUE: "border-red-200 bg-red-50 text-red-700", CANCELLED: "border-slate-200 bg-slate-50 text-slate-400" }[s] || "")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
          <div><h1 className="text-2xl font-bold tracking-tight">Payments</h1><p className="text-muted-foreground">{circle.name} — Tracked payments and dues</p></div>
        </div>
        {isAdmin && (
          <form action={async (fd) => {
            "use server"
            try {
              const { generateMonthlyPaymentIntents } = await import("@/lib/services/circle-payment.service")
              const { auth } = await import("@/lib/auth")
              const s = await auth()
              if (!s?.user?.id) return
              await generateMonthlyPaymentIntents(circleId, s.user.id)
              revalidatePath(`/circles/${circleId}/payments`)
            } catch (e) {
              console.error("Generate dues failed:", e)
            }
          }}>
            <Button type="submit" size="sm" className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-3.5 mr-1" /> Generate Dues</Button>
          </form>
        )}
      </div>

      {/* My Payments */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">My Payments ({userPayments.length})</CardTitle></CardHeader><CardContent className="p-0">
        {userPayments.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">No payments yet</p> : (
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Type</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Due</th><th className="p-3 pr-4">Action</th></tr></thead>
            <tbody>{userPayments.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30">
                <td className="p-3 pl-4"><Badge variant="outline" className="text-[10px]">{p.type.replace(/_/g, " ")}</Badge></td>
                <td className="p-3 font-mono">{symbol}{Number(p.amount).toLocaleString()}</td>
                <td className="p-3"><Badge variant="outline" className={`text-[10px] ${statusBadge(p.status)}`}>{p.status.replace(/_/g, " ")}</Badge></td>
                <td className="p-3 text-muted-foreground">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "—"}</td>
                <td className="p-3 pr-4">
                  {(p.status === "PENDING" || p.status === "OVERDUE") && (
                    <form action={async (fd) => {
                      "use server"
                      try {
                        const { submitProofOfPayment } = await import("@/lib/services/circle-payment.service")
                        const { auth } = await import("@/lib/auth")
                        const s = await auth()
                        if (!s?.user?.id) return
                        await submitProofOfPayment(p.id, s.user.id, fd.get("ref") as string || "")
                        revalidatePath(`/circles/${circleId}/payments`)
                      } catch (e) {
                        console.error("Proof submission failed:", e)
                      }
                    }} className="flex gap-1">
                      <input name="ref" className="rounded-lg border px-2 py-1 text-xs w-32" placeholder="Reference/note..." />
                      <Button type="submit" size="sm" className="h-7 rounded-lg text-xs bg-brand hover:bg-brand-600"><Upload className="size-3 mr-0.5" /> Proof</Button>
                    </form>
                  )}
                  {p.status === "PROOF_SUBMITTED" && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]"><Clock className="size-3 mr-0.5" /> Awaiting</Badge>}
                  {p.status === "CONFIRMED" && <CheckCircle2 className="size-4 text-emerald-600" />}
                  {p.status === "REJECTED" && <XCircle className="size-4 text-red-500" />}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </CardContent></Card>

      {/* All Payments (admin only) */}
      {isAdmin && (
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">All Member Payments ({allPayments.length})</CardTitle></CardHeader><CardContent className="p-0">
          {allPayments.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">No payments</p> : (
            <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Member</th><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Due</th><th className="p-3 pr-4">Action</th></tr></thead>
              <tbody>{allPayments.map((p) => (
                <tr key={p.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 pl-4 font-medium">{p.user?.name || p.user?.email}</td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{p.type.replace(/_/g, " ")}</Badge></td>
                  <td className="p-3 font-mono">{symbol}{Number(p.amount).toLocaleString()}</td>
                  <td className="p-3"><Badge variant="outline" className={`text-[10px] ${statusBadge(p.status)}`}>{p.status.replace(/_/g, " ")}</Badge></td>
                  <td className="p-3 text-muted-foreground">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "—"}</td>
                  <td className="p-3 pr-4">
                    {p.status === "PROOF_SUBMITTED" && (
                      <div className="flex gap-1">
                        {p.proofReference && <span className="text-xs text-muted-foreground mr-1 truncate max-w-[80px]">{p.proofReference}</span>}
                        <form action={async () => {
                          "use server"
                          try {
                            const { confirmPaymentIntent } = await import("@/lib/services/circle-payment.service")
                            const { auth } = await import("@/lib/auth")
                            const s = await auth()
                            if (!s?.user?.id) return
                            await confirmPaymentIntent(p.id, s.user.id)
                            revalidatePath(`/circles/${circleId}/payments`)
                          } catch (e) {
                            console.error("Confirm payment failed:", e)
                          }
                        }}>
                          <Button type="submit" size="sm" className="h-6 rounded text-[10px] bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="size-3" /></Button>
                        </form>
                        <form action={async () => {
                          "use server"
                          try {
                            const { rejectPaymentIntent } = await import("@/lib/services/circle-payment.service")
                            const { auth } = await import("@/lib/auth")
                            const s = await auth()
                            if (!s?.user?.id) return
                            await rejectPaymentIntent(p.id, s.user.id)
                            revalidatePath(`/circles/${circleId}/payments`)
                          } catch (e) {
                            console.error("Reject payment failed:", e)
                          }
                        }}>
                          <Button type="submit" size="sm" variant="outline" className="h-6 rounded text-[10px] text-red-600"><XCircle className="size-3" /></Button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent></Card>
      )}
    </div>
  )
}
