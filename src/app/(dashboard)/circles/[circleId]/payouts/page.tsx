import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users, Wallet, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getPayoutQueue, getPayoutHistory } from "@/lib/services/payout-rotation.service"
import { CURRENCIES } from "@/lib/constants"
import { PayoutActions } from "@/components/payouts/payout-actions"
import { PayoutQueueManage } from "@/components/payouts/payout-queue-manage"

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "border-amber-200 bg-amber-50 text-amber-700",
  READY: "border-brand-200 bg-brand-50 text-brand-700",
  BLOCKED: "border-red-200 bg-red-50 text-red-700",
  PENDING_APPROVAL: "border-purple-200 bg-purple-50 text-purple-700",
  APPROVED: "border-blue-200 bg-blue-50 text-blue-700",
  PAID: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CONFIRMED_RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SKIPPED: "border-slate-200 bg-slate-50 text-slate-500",
  DEFERRED: "border-slate-200 bg-slate-50 text-slate-500",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

export default async function PayoutsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle: any
  let queueData: Awaited<ReturnType<typeof getPayoutQueue>> | null = null
  let history: any[] = []
  try {
    circle = await getCircleById(circleId, session.user.id)
    queueData = await getPayoutQueue(circleId, session.user.id)
    history = await getPayoutHistory(circleId, session.user.id)
  } catch {
    notFound()
  }

  const ccy = CURRENCIES.find((c: any) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency
  const config = queueData?.config
  const compliance = queueData?.compliance
  const queue = queueData?.queue ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Payout Rotation</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
        <PayoutQueueManage
          circleId={circleId}
          hasQueue={queue.length > 0}
          canManage={!!queueData?.canManage}
          mode={config?.mode ?? null}
        />
      </div>

      {!queueData || queue.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">No payout rotation yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Set up the payout rotation to start distributing the stokvel pool. Use the "Set up rotation" button above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Compliance */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Pool Required</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{symbol}{(compliance?.expectedTotal ?? 0).toLocaleString()}</div></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Collected</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-emerald-600">{symbol}{(compliance?.collected ?? 0).toLocaleString()}</div></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm text-muted-foreground">Shortfall</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${(compliance?.shortfall ?? 0) <= 0 ? "text-emerald-600" : "text-amber-600"}`}>{symbol}{Math.max(0, compliance?.shortfall ?? 0).toLocaleString()}</div></CardContent></Card>
          </div>

          {/* Config summary */}
          {config && (
            <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base text-brand-800">Rotation Configuration</CardTitle>
                <Badge className="bg-brand text-white">{config.mode.replace(/_/g, " ")}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Frequency: </span><span className="font-medium">{config.frequency}</span></div>
                <div><span className="text-muted-foreground">Amount: </span><span className="font-medium">{config.useCollectedPot ? "Collected pot" : `${symbol}${(config.amount ?? 0).toLocaleString()}`}</span></div>
                <div><span className="text-muted-foreground">Grace days: </span><span className="font-medium">{config.graceDays ?? 0}</span></div>
                <div><span className="text-muted-foreground">Member confirmations: </span><span className="font-medium">{config.requireConfirmedContributions ? "Required" : "Not required"}</span></div>
                <div><span className="text-muted-foreground">Beneficiary confirmation: </span><span className="font-medium">{config.requireBeneficiaryConfirmation ? "Required" : "Not required"}</span></div>
                <div><span className="text-muted-foreground">Swap allowed: </span><span className="font-medium">{config.allowSwap ? "Yes" : "No"}</span></div>
              </CardContent>
            </Card>
          )}

          {/* My position */}
          {queueData?.myCycle && (
            <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Wallet className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Your payout position</p>
                  <p className="text-xs text-muted-foreground">
                    {symbol}{(queueData.myCycle.amount ?? 0).toLocaleString()} at cycle #{queueData.myCycle.cycleNumber}
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white">#{queueData.myCycle.cycleNumber}</Badge>
              </CardContent>
            </Card>
          )}

          {/* Queue */}
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Rotation Queue</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {queue.map((p: any) => {
                  const init = p.recipient?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
                  const actionsVisible = ["UPCOMING", "READY", "BLOCKED", "PENDING_APPROVAL", "APPROVED", "PAID"].includes(p.status)
                  const myCycle = queueData?.myCycle && queueData.myCycle.cycleNumber === p.cycleNumber
                  return (
                    <div key={p.id} className={`rounded-xl border border-border/40 p-3 ${myCycle ? "ring-1 ring-emerald-300" : ""}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-14 justify-center text-xs">#{p.cycleNumber}</Badge>
                        <Avatar className="size-8"><AvatarImage src={p.recipient?.image || ""} /><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {p.recipient?.name || p.recipient?.email || "—"}
                            {myCycle && <span className="ml-2 text-[10px] text-emerald-600 font-semibold">YOU</span>}
                          </p>
                          {p.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(p.dueDate).toLocaleDateString()}</p>}
                        </div>
                        <span className="font-mono font-bold text-sm">{symbol}{p.amount.toLocaleString()}</span>
                        <Badge variant="outline" className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge>
                      </div>
                      {p.readiness && p.readiness !== "READY" && p.status === "BLOCKED" && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                          <span>{p.readiness}</span>
                        </div>
                      )}
                      {p.skipReason && (
                        <p className="mt-2 text-xs text-slate-500">Skipped: {p.skipReason}</p>
                      )}
                      {actionsVisible && (
                        <div className="mt-2">
                          <PayoutActions
                            circleId={circleId}
                            cycle={{ id: p.id, cycleNumber: p.cycleNumber, status: p.status }}
                            canPrepare={!!queueData?.canPrepare}
                            canRecord={!!queueData?.canRecord}
                            canSkipDefer={!!queueData?.canManage}
                            canSwap={!!queueData?.canManage}
                            canConfirm={!!queueData?.canManage}
                            canReport={!!queueData?.canManage}
                            allowSwap={!!config?.allowSwap}
                            queueCycles={queue.map((c: any) => ({ id: c.id, cycleNumber: c.cycleNumber, name: c.recipient?.name || "Member" }))}
                            isBeneficiary={p.recipient?.id === session.user.id}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Payout History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.slice(0, 10).map((h: any) => {
                    const init = h.recipient?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
                    return (
                      <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                        <Avatar className="size-8"><AvatarImage src={h.recipient?.image || ""} /><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{h.recipient?.name || h.recipient?.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {h.status === "SKIPPED" ? `Skipped: ${h.skipReason}` : h.status === "DEFERRED" ? `Deferred: ${h.deferReason}` : h.paidDate ? `Paid ${new Date(h.paidDate).toLocaleDateString()}${h.reference ? ` · ${h.reference}` : ""}` : ""}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-sm">{symbol}{h.amount.toLocaleString()}</span>
                        <Badge variant="outline" className={STATUS_COLORS[h.status] || ""}>{h.status}</Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
