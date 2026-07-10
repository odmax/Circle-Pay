import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { listWalletApprovalRequests } from "@/lib/services/wallet.service"
import { CURRENCIES } from "@/lib/constants"
import { WalletApprovalActions } from "@/components/wallet/wallet-approval-actions"

export default async function WalletApprovalsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle, requests
  try { [circle, requests] = await Promise.all([getCircleById(circleId, session.user.id), listWalletApprovalRequests(circleId, session.user.id)]) }
  catch { notFound() }

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency
  const canManage = circle.userRole === "OWNER" || circle.userRole === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/wallet`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Approvals</h1><p className="text-muted-foreground">{circle.name} — {requests.length} request{requests.length !== 1 ? "s" : ""}</p></div>
      </div>

      {requests.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-12 text-center"><p className="text-sm text-muted-foreground">No payout requests</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const approverNames = r.approvals.map((a) => a.approvedBy.name?.split(" ")[0] || "?").join(", ")
            return (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{symbol}{Number(r.walletTx.amount).toLocaleString()}</span>
                    <Badge variant="outline" className={r.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : r.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">by {r.requestedBy.name || r.requestedBy.email} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">{r.walletTx.description}</p>
                  <p className="text-xs">{r.approvals.length} of {r.requiredCount} approvals {approverNames ? `(${approverNames})` : ""}</p>
                </div>
                {r.status === "PENDING" && canManage && (
                  <WalletApprovalActions circleId={circleId} requestId={r.id} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
