import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { CURRENCIES } from "@/lib/constants"
import { YearEndClient, type YearEndPermissions } from "@/components/year-end/year-end-client"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function YearEndPage({
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

  const canViewYearEnd = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.YEAR_END_VIEW,
  })
  const canManageYearEnd = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE,
  })
  const canApproveYearEnd = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.YEAR_END_APPROVE,
  })
  const canAdjustYearEnd = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.YEAR_END_ADJUST,
  })

  const permissions: YearEndPermissions = {
    canView: canViewYearEnd,
    canManage: canManageYearEnd,
    canApprove: canApproveYearEnd,
    canAdjust: canAdjustYearEnd,
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Year-End Close</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <YearEndClient
        circleId={circleId}
        userId={session.user.id}
        symbol={symbol}
        permissions={permissions}
      />
    </div>
  )
}
