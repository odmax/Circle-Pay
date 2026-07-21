"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, RotateCcw } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ContributionStatusBadge } from "./contribution-status-badge"
import { EditContributionDialog } from "./edit-contribution-dialog"
import { toast } from "sonner"

interface ContributionRow {
  id: string
  amount: number
  status: string
  paymentDate: Date | string
  note: string | null
  createdAt: Date | string
  deletedAt?: Date | string | null
  statusBeforeDeletion?: string | null
  user: { id: string; name: string | null; email: string; image: string | null }
  plan: { id: string; name: string; amount: number } | null
  createdBy: { id: string; name: string | null }
}

export function ContributionHistoryTable({
  circleId,
  contributions,
  currencySymbol,
  plans,
  canManage,
  showDeletedToggle,
  onToggleShowDeleted,
  showDeleted,
}: {
  circleId: string
  contributions: ContributionRow[]
  currencySymbol: string
  plans: { id: string; name: string }[]
  canManage: boolean
  showDeletedToggle?: boolean
  onToggleShowDeleted?: () => void
  showDeleted?: boolean
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function handleDelete(contributionId: string) {
    setDeletingId(contributionId)
    try {
      const res = await fetch(`/api/circles/${circleId}/contributions/${contributionId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to delete contribution")
        return
      }
      toast.success("Contribution voided")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestore(contributionId: string) {
    setRestoringId(contributionId)
    try {
      const res = await fetch(`/api/circles/${circleId}/contributions/${contributionId}/restore`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to restore contribution")
        return
      }
      toast.success("Contribution restored")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setRestoringId(null)
    }
  }

  if (contributions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
          <span className="text-lg text-muted-foreground">R</span>
        </div>
        <h4 className="text-sm font-medium">
          {showDeleted ? "No deleted contributions" : "No contributions yet"}
        </h4>
        <p className="text-xs text-muted-foreground">
          {showDeleted ? "Voided contributions will appear here" : "Record a payment to get started"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showDeletedToggle && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={onToggleShowDeleted}
            className="rounded border-border"
          />
          Show voided contributions
        </label>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-xs font-medium text-muted-foreground">
              <th className="pb-3 pl-1 pr-3">Member</th>
              <th className="px-3 pb-3">Amount</th>
              <th className="px-3 pb-3">Plan</th>
              <th className="px-3 pb-3">Date</th>
              <th className="px-3 pb-3">Status</th>
              <th className="px-3 pb-3 hidden sm:table-cell">Note</th>
              {canManage && <th className="px-3 pb-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => {
              const initials = c.user.name
                ? c.user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "??"
              const isDeleted = !!c.deletedAt

              return (
                <tr
                  key={c.id}
                  className={
                    "border-b border-border/20 transition-colors" +
                    (isDeleted ? " opacity-50" : " hover:bg-muted/30")
                  }
                >
                  <td className="py-3 pl-1 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={c.user.image || ""} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate max-w-[100px]">
                        {c.user.name || c.user.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono font-medium">
                    {currencySymbol}
                    {Number(c.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {c.plan?.name || "\u2014"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(c.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <ContributionStatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell max-w-[120px] truncate">
                    {c.note || "\u2014"}
                  </td>
                  {canManage && (
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {isDeleted ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            onClick={() => handleRestore(c.id)}
                            disabled={restoringId === c.id || c.statusBeforeDeletion === "CONFIRMED"}
                            title={
                              c.statusBeforeDeletion === "CONFIRMED"
                                ? "Create a new contribution instead"
                                : "Restore"
                            }
                          >
                            {restoringId === c.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3.5" />
                            )}
                          </Button>
                        ) : (
                          <>
                            <EditContributionDialog
                              circleId={circleId}
                              contribution={{
                                id: c.id,
                                amount: Number(c.amount),
                                status: c.status,
                                paymentDate: c.paymentDate.toString(),
                                note: c.note,
                                planId: c.plan?.id || null,
                              }}
                              plans={plans}
                              currencySymbol={currencySymbol}
                            />
                            <Dialog>
                              <DialogTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-7 text-destructive/70 hover:text-destructive"
                                    title="Void"
                                  />
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Void contribution?</DialogTitle>
                                  <DialogDescription>
                                    This will reverse the ledger entry, void any associated receipt,
                                    and mark the contribution as cancelled. This action cannot be
                                    undone, but the record can be restored later.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2">
                                  <DialogTrigger render={<Button variant="outline" className="rounded-xl" />}>
                                    Cancel
                                  </DialogTrigger>
                                  <Button
                                    className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDelete(c.id)}
                                    disabled={deletingId === c.id}
                                  >
                                    {deletingId === c.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      "Void Contribution"
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
