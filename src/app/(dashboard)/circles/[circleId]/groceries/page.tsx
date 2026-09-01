import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { Groceries } from "@/components/household/groceries"

export default async function GroceriesPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }
  if (circle.type !== "HOUSEMATE") notFound()

  return <Groceries circleId={circleId} circleName={circle.name} currency={circle.currency} />
}