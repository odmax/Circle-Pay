import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleMembers, getCircleById } from "@/lib/services/circle.service"
import { MembersList, InviteSection } from "@/components/circles/members-list"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export default async function CircleMembersPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle, members
  try {
    ;[circle, members] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getCircleMembers(circleId, session.user.id),
    ])
  } catch {
    notFound()
  }

  const canInvite = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_INVITE })
  const canManageRoles = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_ROLE_UPDATE })
  const canRemoveMembers = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.MEMBER_REMOVE })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href={`/circles/${circleId}`} />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            {circle.name} — {members.length} member
            {members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MembersList
            members={members}
            circleId={circleId}
            canManageRoles={canManageRoles}
            canRemoveMembers={canRemoveMembers}
          />
        </div>
        <div>
          <InviteSection
            inviteCode={circle.inviteCode}
            circleId={circleId}
            canInvite={canInvite}
          />
        </div>
      </div>
    </div>
  )
}
