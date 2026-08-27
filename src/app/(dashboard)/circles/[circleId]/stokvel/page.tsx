import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getStokvelDashboard } from "@/lib/services/stokvel-dashboard.service"
import { StokvelDashboard } from "@/components/stokvel/stokvel-dashboard"
import { CURRENCIES } from "@/lib/constants"

export default async function StokvelDashboardPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let data
  try {
    data = await getStokvelDashboard(circleId, session.user.id)
  } catch {
    notFound()
  }

  const symbol =
    CURRENCIES.find((c) => c.code === data.circle.currency)?.symbol ??
    data.circle.currency

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
          <h1 className="text-2xl font-bold tracking-tight">Stokvel Dashboard</h1>
          <p className="text-muted-foreground">{data.circle.name}</p>
        </div>
      </div>

      <StokvelDashboard data={data} symbol={symbol} userId={session.user.id} />
    </div>
  )
}
