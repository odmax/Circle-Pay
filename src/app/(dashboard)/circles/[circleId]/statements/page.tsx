import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { StatementDownloader } from "@/components/receipts/statement-downloader"
import { CURRENCIES } from "@/lib/constants"

export default async function StatementsPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const symbol =
    CURRENCIES.find((c) => c.code === circle.currency)?.symbol ??
    circle.currency

  const members = circle.members.map((m) => ({
    id: m.user.id,
    name: m.user.name || m.user.email,
  }))

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
          <h1 className="text-2xl font-bold tracking-tight">Statements</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <FileText className="size-6" />
            </div>
            <div>
              <h3 className="font-semibold">Member Statement</h3>
              <p className="text-xs text-muted-foreground">
                Individual member activity and balance
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="size-6" />
            </div>
            <div>
              <h3 className="font-semibold">Circle Statement</h3>
              <p className="text-xs text-muted-foreground">
                Full circle activity summary
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Download className="size-6" />
            </div>
            <div>
              <h3 className="font-semibold">Export Data</h3>
              <p className="text-xs text-muted-foreground">
                Download as PDF or JSON
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <StatementDownloader
        circleId={circleId}
        members={members}
        currencySymbol={symbol}
      />
    </div>
  )
}
