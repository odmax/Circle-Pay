import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { CURRENCIES } from "@/lib/constants"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { GroceryClient, type GroceryPermissions } from "@/components/grocery/grocery-client"

export default async function GroceryPage({
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

  const symbol = CURRENCIES.find((c) => c.code === circle.currency)?.symbol ?? circle.currency

  const canViewAll = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_ALL })
  const canCreateCampaign = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_CREATE })
  const canManageCampaign = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE })

  const permissions: GroceryPermissions = { canViewAll, canCreateCampaign, canManageCampaign }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}/stokvel`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grocery</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <GroceryClient circleId={circleId} symbol={symbol} permissions={permissions} />
    </div>
  )
}
