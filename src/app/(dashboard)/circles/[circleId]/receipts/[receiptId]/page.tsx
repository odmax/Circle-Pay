import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getReceiptById } from "@/lib/services/receipt.service"
import { ReceiptDetail } from "@/components/receipts/receipt-detail"
import { CURRENCIES } from "@/lib/constants"

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; receiptId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId, receiptId } = await params

  let circle, receipt
  try {
    ;[circle, receipt] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getReceiptById(receiptId),
    ])
  } catch {
    notFound()
  }

  if (!receipt || receipt.circleId !== circleId) notFound()

  const symbol =
    CURRENCIES.find((c) => c.code === circle.currency)?.symbol ??
    circle.currency

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          render={<Link href={`/circles/${circleId}/receipts`} />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipt</h1>
          <p className="text-muted-foreground">{receipt.receiptNumber}</p>
        </div>
      </div>

      <ReceiptDetail
        receipt={receipt as never}
        currencySymbol={symbol}
        circleId={circleId}
        userRole={circle.userRole as string}
      />
    </div>
  )
}
