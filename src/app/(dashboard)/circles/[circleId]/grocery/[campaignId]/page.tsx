import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { CURRENCIES } from "@/lib/constants"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  GroceryCampaignClient,
  type GroceryCampaignPermissions,
} from "@/components/grocery/grocery-campaign-client"

export default async function GroceryCampaignPage({
  params,
}: {
  params: Promise<{ circleId: string; campaignId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId, campaignId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const symbol = CURRENCIES.find((c) => c.code === circle.currency)?.symbol ?? circle.currency

  const [canViewAll, canManageCampaign, canManageList, canCreateQuote, canApproveQuote, canManagePurchase, canManageAllocation, canConfirmOwn, canSubmitOwn, canCreateContribution, canReconcile, canCorrect] = await Promise.all([
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_ALL }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_LIST_MANAGE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_QUOTE_CREATE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_QUOTE_APPROVE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_PURCHASE_MANAGE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_ALLOCATION_MANAGE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_COLLECTION_CONFIRM_OWN }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_RECONCILE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CORRECT }),
  ])

  const permissions: GroceryCampaignPermissions = {
    canViewAll,
    canManageCampaign,
    canManageList,
    canCreateQuote,
    canApproveQuote,
    canManagePurchase,
    canManageAllocation,
    canConfirmOwn,
    canSubmitOwn,
    canCreateContribution,
    canReconcile,
    canCorrect,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}/grocery`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grocery campaign</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <GroceryCampaignClient
        circleId={circleId}
        campaignId={campaignId}
        userId={session.user.id}
        symbol={symbol}
        permissions={permissions}
      />
    </div>
  )
}
