"use client"

import { useRouter } from "next/navigation"
import { Loader2, Check, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SettlementStatusBadge } from "./settlement-status-badge"
import { toast } from "sonner"

interface SettlementRow {
  id: string
  amount: number
  note: string | null
  settlementDate: Date
  status: string
  createdAt: Date
  debtor: { id: string; name: string | null; email: string; image: string | null }
  creditor: { id: string; name: string | null; email: string; image: string | null }
  createdBy: { id: string; name: string | null }
  confirmedBy: { id: string; name: string | null } | null
}

export function SettlementHistory({
  settlements,
  circleId,
  currencySymbol,
  currentUserId,
  canManage,
}: {
  settlements: SettlementRow[]
  circleId: string
  currencySymbol: string
  currentUserId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleAction(settlementId: string, action: "confirm" | "reject") {
    setLoadingId(settlementId)
    try {
      const res = await fetch(`/api/circles/${circleId}/settlements/${settlementId}/${action}`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || `Failed to ${action}`)
        return
      }
      toast.success(action === "confirm" ? "Settlement confirmed!" : "Settlement rejected")
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setLoadingId(null) }
  }

  if (settlements.length === 0) return null

  return (
    <div className="space-y-2">
      {settlements.map((s) => {
        const canAct = (canManage || s.creditor.id === currentUserId) && s.status === "PENDING"
        const dInit = s.debtor.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
        const cInit = s.creditor.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
        return (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
            <div className="flex items-center -space-x-2">
              <Avatar className="size-8 border-2 border-background"><AvatarImage src={s.debtor.image || ""} /><AvatarFallback className="text-[10px]">{dInit}</AvatarFallback></Avatar>
              <Avatar className="size-8 border-2 border-background"><AvatarImage src={s.creditor.image || ""} /><AvatarFallback className="text-[10px]">{cInit}</AvatarFallback></Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{s.debtor.name || s.debtor.email}</span>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium">{s.creditor.name || s.creditor.email}</span>
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <SettlementStatusBadge status={s.status} />
                <span>{new Date(s.settlementDate).toLocaleDateString()}</span>
                {s.note && <span className="truncate">· {s.note}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono font-bold text-sm">{currencySymbol}{s.amount.toLocaleString()}</span>
              {canAct && (
                <div className="flex gap-1 mt-1 justify-end">
                  <Button size="sm" variant="outline" className="h-7 rounded-lg text-emerald-600" onClick={() => handleAction(s.id, "confirm")} disabled={loadingId === s.id}>
                    {loadingId === s.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 rounded-lg text-red-600" onClick={() => handleAction(s.id, "reject")} disabled={loadingId === s.id}>
                    <X className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
