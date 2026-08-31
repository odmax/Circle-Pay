import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { CapitalCallDetail } from "@/components/capital-calls/capital-call-detail"

export default async function CapitalCallDetailPage({ params }: { params: Promise<{ circleId: string; callId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId, callId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CAPITAL_CALL_MANAGE })

  return <CapitalCallDetail circleId={circleId} circleName={circle.name} currency={circle.currency} callId={callId} canManage={canManage} />
}