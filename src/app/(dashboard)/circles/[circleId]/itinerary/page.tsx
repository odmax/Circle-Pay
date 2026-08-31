import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { TravelItinerary } from "@/components/travel/travel-itinerary"

export default async function TravelItineraryPage({ params }: { params: Promise<{ circleId: string }> }) {
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

  return <TravelItinerary circleId={circleId} circleName={circle.name} currency={circle.currency} canManage={canManage} />
}