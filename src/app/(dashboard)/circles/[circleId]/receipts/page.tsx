import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import {
  getCircleReceipts,
  getReceiptStats,
} from "@/lib/services/receipt.service"
import { ReceiptsListManager } from "@/components/receipts/receipts-list-manager"
import { CURRENCIES } from "@/lib/constants"

export default async function CircleReceiptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ circleId: string }>
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params
  const sp = await searchParams

  let circle, receiptsData, stats
  try {
    ;[circle, receiptsData, stats] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getCircleReceipts(circleId, {
        type: sp.type as never,
        status: sp.status as never,
        search: sp.search,
        limit: 25,
        offset: 0,
      }),
      getReceiptStats(circleId),
    ])
  } catch {
    notFound()
  }

  const symbol =
    CURRENCIES.find((c) => c.code === circle.currency)?.symbol ??
    circle.currency

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          render={<Link href={`/circles/${circleId}`} />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <ReceiptsListManager
        circleId={circleId}
        initialReceipts={receiptsData.receipts as never}
        initialTotal={receiptsData.total}
        stats={stats}
        currencySymbol={symbol}
        userRole={circle.userRole as string}
      />
    </div>
  )
}
