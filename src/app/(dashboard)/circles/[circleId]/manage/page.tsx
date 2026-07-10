import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { ManageCircleForm } from "@/components/circles/manage-circle-form"

export default async function ManageCirclePage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle
  try { circle = await getCircleById(circleId, session.user.id) } catch { notFound() }

  const canManage = circle.userRole === "OWNER" || circle.userRole === "ADMIN"
  if (!canManage) redirect(`/circles/${circleId}`)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Circle</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg">
        <ManageCircleForm
          circle={{
            id: circle.id,
            name: circle.name,
            description: circle.description,
            currency: circle.currency,
            type: circle.type,
            settings: (circle as unknown as { settings: Record<string, unknown> | null }).settings || null,
          }}
        />
      </div>
    </div>
  )
}
