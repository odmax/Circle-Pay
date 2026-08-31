import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { isProjectInvestor } from "@/lib/services/investor-relations.service"

export interface InvestorCtx {
  userId: string
  viewerUserId: string
  circleId: string
  projectId: string
  isInvestor: boolean
  isManager: boolean
}

export async function getInvestorCtx(circleId: string, projectId: string): Promise<InvestorCtx | null> {
  const s = await auth()
  if (!s?.user?.id) return null
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_VIEW })
  if (!allowed) return null
  await requireProjectInCircle(projectId, circleId)
  const [isInvestor, m1, m2, m3, m4] = await Promise.all([
    isProjectInvestor(projectId, s.user.id),
    hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_UPDATE_MANAGE }),
    hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_MILESTONE_MANAGE }),
    hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_QUESTION_ANSWER }),
    hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_DOCUMENT_MANAGE }),
  ])
  return { userId: s.user.id, viewerUserId: s.user.id, circleId, projectId, isInvestor, isManager: m1 || m2 || m3 || m4 }
}