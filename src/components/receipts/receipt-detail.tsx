"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Download,
  XCircle,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Calendar,
  User,
  FileText,
  Clock,
  Link as LinkIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"
import { ReceiptQrCode } from "@/components/receipts/receipt-qr-code"
import { APP_URL } from "@/lib/constants"

type ReceiptData = {
  id: string
  receiptNumber: string
  type: string
  status: "ACTIVE" | "VOIDED" | "REPLACED"
  amount: unknown
  currency: string
  title: string
  description: string | null
  paymentReference: string | null
  transactionDate: string
  issuedAt: string
  voidedAt: string | null
  voidReason: string | null
  verificationToken: string
  replacementReceiptId: string | null
  metadata: Record<string, unknown> | null
  circle: { id: string; name: string }
  issuedTo: { id: string; name: string | null; email: string; image: string | null } | null
  issuedBy: { id: string; name: string | null; email: string; image: string | null } | null
  voidedBy: { id: string; name: string | null; email: string } | null
}

interface ReceiptDetailProps {
  receipt: ReceiptData
  currencySymbol: string
  circleId: string
  userRole: string
}

export function ReceiptDetail({
  receipt,
  currencySymbol,
  circleId,
  userRole,
}: ReceiptDetailProps) {
  const router = useRouter()
  const [voiding, setVoiding] = useState(false)
  const [replacing, setReplacing] = useState(false)

  const meta = (receipt.metadata ?? {}) as Record<string, unknown>
  const verificationUrl = `${APP_URL}/verify/receipt/${receipt.verificationToken}`

  const handleDownloadPdf = async () => {
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

  const handleVoid = async () => {
    const reason = prompt("Enter reason for voiding this receipt:")
    if (!reason) return
    setVoiding(true)
    try {
      const res = await fetch(
        `/api/circles/${circleId}/receipts/${receipt.id}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed")
      }
      toast.success("Receipt voided")
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to void receipt")
    } finally {
      setVoiding(false)
    }
  }

  const handleReplace = async () => {
    const reason = prompt("Enter reason for replacing this receipt:")
    if (!reason) return
    setReplacing(true)
    try {
      const res = await fetch(
        `/api/circles/${circleId}/receipts/${receipt.id}/replace`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed")
      }
      toast.success("Receipt replaced")
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to replace receipt")
    } finally {
      setReplacing(false)
    }
  }

  const canAdjust =
    receipt.status === "ACTIVE" &&
    (userRole === "OWNER" || userRole === "ADMIN" || userRole === "TREASURER")

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ReceiptStatusBadge status={receipt.status} />
                  <Badge variant="outline" className="text-[10px]">
                    {receipt.type.replace(/_/g, " ")}
                  </Badge>
                </div>
                <CardTitle className="text-lg font-mono">
                  {receipt.receiptNumber}
                </CardTitle>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {currencySymbol}
                  {Number(receipt.amount).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">{receipt.currency}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Issued to</p>
                  <p className="font-medium">
                    {receipt.issuedTo?.name ?? receipt.issuedTo?.email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Issued by</p>
                  <p className="font-medium">
                    {receipt.issuedBy?.name ?? receipt.issuedBy?.email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Transaction date</p>
                  <p className="font-medium">
                    {new Date(receipt.transactionDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Issued at</p>
                  <p className="font-medium">
                    {new Date(receipt.issuedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Circle</p>
                <p className="font-medium">{receipt.circle.name}</p>
              </div>
              {receipt.paymentReference && (
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Payment reference</p>
                  <p className="font-medium">{receipt.paymentReference}</p>
                </div>
              )}
            </div>

            {typeof meta.planName === "string" && meta.planName && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Plan</p>
                <p className="font-medium">{meta.planName as string}</p>
              </div>
            )}

            {typeof meta.approverNames === "string" && meta.approverNames && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Approvers</p>
                <p className="font-medium">{meta.approverNames as string}</p>
              </div>
            )}

            {receipt.description && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p>{receipt.description}</p>
              </div>
            )}

            {receipt.status === "VOIDED" && receipt.voidReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
                <p className="font-medium text-red-700">Void reason</p>
                <p className="text-red-600">{receipt.voidReason}</p>
                {receipt.voidedAt && (
                  <p className="mt-1 text-xs text-red-500">
                    Voided on {new Date(receipt.voidedAt).toLocaleDateString()}
                    {receipt.voidedBy && ` by ${receipt.voidedBy.name ?? receipt.voidedBy.email}`}
                  </p>
                )}
              </div>
            )}

            {receipt.replacementReceiptId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-700">
                  This receipt has been replaced
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleDownloadPdf}
          >
            <Download className="size-3.5 mr-1" /> Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            render={
              <a href={verificationUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="size-3.5 mr-1" /> Verify Online
          </Button>
          {canAdjust && (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-xl"
                onClick={handleVoid}
                disabled={voiding || replacing}
              >
                <XCircle className="size-3.5 mr-1" /> Void
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleReplace}
                disabled={voiding || replacing}
              >
                <RefreshCw className="size-3.5 mr-1" /> Replace
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ReceiptQrCode verificationUrl={verificationUrl} size={160} />
            <div className="w-full space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                Scan to verify
              </p>
              <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5">
                <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-brand hover:underline"
                >
                  {verificationUrl}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle className="size-3.5 text-emerald-500" />
              Circle Pay Verified Receipt
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="size-3 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Receipt issued</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(receipt.issuedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {receipt.status === "VOIDED" && receipt.voidedAt && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="size-3 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Receipt voided</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(receipt.voidedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
