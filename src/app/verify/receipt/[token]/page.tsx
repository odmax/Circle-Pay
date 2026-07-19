import { notFound } from "next/navigation"
import { CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"
import { getReceiptByVerificationToken } from "@/lib/services/receipt.service"
import { CURRENCIES } from "@/lib/constants"
import Link from "next/link"

type ReceiptMetadata = {
  circleName?: string
  circleCode?: string
  [key: string]: unknown
}

export default async function VerifyReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const receipt = await getReceiptByVerificationToken(token)

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md rounded-2xl border-border/40">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-slate-100">
              <XCircle className="size-8 text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Receipt Not Found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This verification link is invalid or the receipt does not exist.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const meta = (receipt.metadata ?? {}) as ReceiptMetadata
  const symbol =
    CURRENCIES.find((c) => c.code === receipt.currency)?.symbol ??
    receipt.currency

  const isVoided = receipt.status === "VOIDED"
  const isReplaced = receipt.status === "REPLACED"

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            {isVoided ? (
              <>
                <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="size-8 text-red-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Receipt Voided</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This receipt has been voided and is no longer valid.
                  </p>
                </div>
              </>
            ) : isReplaced ? (
              <>
                <div className="flex size-16 items-center justify-center rounded-full bg-amber-100">
                  <AlertTriangle className="size-8 text-amber-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Receipt Replaced</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This receipt has been replaced with a newer version.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="size-8 text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Valid Receipt</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This receipt is authentic and verified.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Receipt Number</span>
              <span className="font-mono text-sm font-medium">
                {receipt.receiptNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Circle</span>
              <span className="text-sm font-medium">
                {meta.circleName ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="outline" className="text-[10px]">
                {receipt.type.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-lg font-bold">
                {symbol}
                {Number(receipt.amount).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Transaction Date</span>
              <span className="text-sm">
                {new Date(receipt.transactionDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Issued</span>
              <span className="text-sm">
                {new Date(receipt.issuedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <ReceiptStatusBadge status={receipt.status} />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <Shield className="size-3.5" />
          Verified by Circle Pay
        </div>
      </div>
    </div>
  )
}
