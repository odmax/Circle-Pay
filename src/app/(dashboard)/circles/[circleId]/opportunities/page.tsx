import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { OpportunitiesIndex } from "@/components/opportunities/opportunities-index"

export default async function OpportunitiesPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const canCreate = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_CREATE })

  return <OpportunitiesIndex circleId={circleId} circleName={circle.name} currency={circle.currency} canCreate={canCreate} />
}