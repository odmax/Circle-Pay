import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCircleMemberPermissions } from "@/lib/permissions/circle-permissions"
import { CirclePermissionsManager } from "@/components/circles/circle-permissions-manager"
import type { CirclePermission } from "@/lib/permissions/circlePermissions"

export default async function CirclePermissionsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  const actorPerms = await getCircleMemberPermissions({ userId: session.user.id, circleId })
  if (!actorPerms) notFound()

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { id: true, name: true } })
  if (!circle) notFound()

  const members = await prisma.circleMember.findMany({
    where: { circleId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      permissions: { select: { id: true, permission: true, granted: true, grantedById: true, createdAt: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  })

  const serializedMembers = members.map(m => ({
    id: m.id,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    user: m.user,
    overrides: m.permissions.map(p => ({ id: p.id, permission: p.permission as CirclePermission, granted: p.granted, grantedById: p.grantedById, createdAt: p.createdAt.toISOString() })),
  }))

  return (
    <CirclePermissionsManager
      circleId={circleId}
      circleName={circle.name}
      actorPermissions={actorPerms.permissions}
      members={serializedMembers}
    />
  )
}
