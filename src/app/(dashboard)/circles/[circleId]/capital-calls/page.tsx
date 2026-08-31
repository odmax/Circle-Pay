import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { CapitalCallsIndex } from "@/components/capital-calls/capital-calls-index"

export default async function CapitalCallsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const [canCreate, canManage] = await Promise.all([
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CAPITAL_CALL_CREATE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CAPITAL_CALL_MANAGE }),
  ])

  return <CapitalCallsIndex circleId={circleId} circleName={circle.name} currency={circle.currency} canCreate={canCreate} canManage={canManage} />
}