import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { TravelClose } from "@/components/travel/travel-close"

export default async function TravelClosePage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }
  if (circle.type !== "TRAVEL") notFound()

  const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE })

  return <TravelClose circleId={circleId} circleName={circle.name} currency={circle.currency} canManage={canManage} />
}