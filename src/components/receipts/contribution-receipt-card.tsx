"use client"

import Link from "next/link"
import { Download, ExternalLink, Receipt, Clock } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"

type ReceiptInfo = {
  id: string
  receiptNumber: string
  status: "ACTIVE" | "VOIDED" | "REPLACED"
  verificationToken: string
  currency: string
  amount: unknown
  issuedAt: string
} | null

interface ContributionReceiptCardProps {
  circleId: string
  receipt: ReceiptInfo
  contributionStatus: string
}

export function ContributionReceiptCard({
  circleId,
  receipt,
  contributionStatus,
}: ContributionReceiptCardProps) {
  const handleDownloadPdf = async () => {
    if (!receipt) return
    try {
      const res = await fetch(
        `/api/circles/${circleId}/receipts/${receipt.id}/pdf`
      )
      if (!res.ok) throw new Error("Failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `receipt-${receipt.receiptNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded")
    } catch {
      toast.error("Failed to download PDF")
    }
  }

  if (!receipt) {
    const isPending =
      contributionStatus === "PENDING" ||
      contributionStatus === "PENDING_REVIEW" ||
      contributionStatus === "PROOF_SUBMITTED"
    const isRejected = contributionStatus === "REJECTED"

    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            {isPending ? (
              <Clock className="size-5 text-amber-500" />
            ) : (
              <Receipt className="size-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">No receipt yet</p>
            <p className="text-xs text-muted-foreground">
              {isRejected
                ? "Receipt not issued for rejected contributions"
                : "A receipt will be issued once this contribution is confirmed"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const verificationUrl = `/verify/receipt/${receipt.verificationToken}`

  return (
    <Card className="rounded-2xl border-border/40">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50">
              <Receipt className="size-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-medium">
                  {receipt.receiptNumber}
                </p>
                <ReceiptStatusBadge status={receipt.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Issued {new Date(receipt.issuedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDownloadPdf}
            >
              <Download className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              render={
                <a href={verificationUrl} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
