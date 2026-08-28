import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { NewVoteForm } from "@/components/meetings/new-vote-form"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function NewVotePage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let canManage = false
  try {
    await getCircleById(circleId, session.user.id)
    canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.GOVERNANCE_VOTE_MANAGE })
  } catch {
    notFound()
  }
  if (!canManage) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/votes`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Governance Vote</h1>
          <p className="text-muted-foreground">Raise a motion and open it to members</p>
        </div>
      </div>
      <NewVoteForm circleId={circleId} />
    </div>
  )
}
