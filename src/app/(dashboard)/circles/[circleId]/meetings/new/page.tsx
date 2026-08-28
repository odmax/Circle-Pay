import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { NewMeetingForm } from "@/components/meetings/new-meeting-form"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function NewMeetingPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let canManage = false
  try {
    await getCircleById(circleId, session.user.id)
    canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEETING_CREATE })
  } catch {
    notFound()
  }
  if (!canManage) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/meetings`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Meeting</h1>
          <p className="text-muted-foreground">Schedule a circle meeting</p>
        </div>
      </div>
      <NewMeetingForm circleId={circleId} />
    </div>
  )
}
