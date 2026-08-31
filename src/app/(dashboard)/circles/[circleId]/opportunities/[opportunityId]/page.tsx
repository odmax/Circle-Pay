import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail"

export default async function OpportunityDetailPage({ params }: { params: Promise<{ circleId: string; opportunityId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId, opportunityId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const [canManage, canApprove] = await Promise.all([
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_MANAGE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_APPROVE }),
  ])

  return <OpportunityDetail circleId={circleId} circleName={circle.name} currency={circle.currency} opportunityId={opportunityId} canManage={canManage} canApprove={canApprove} />
}