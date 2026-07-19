import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, apiCreated, mapServiceError } from "@/lib/api/errors"
import { toDelegation } from "@/lib/api/dtos"
import { prisma } from "@/lib/prisma"
import { createDelegation } from "@/lib/services/delegation.service"
import { createDelegationSchema } from "@/lib/validations/approval-workflows"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params

  const access = await requireCircleAccess(circleId)
  if ("error" in access) return access.error

  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get("active")
    const delegatorMemberId = searchParams.get("delegator")
    const delegateMemberId = searchParams.get("delegate")
    const approvalType = searchParams.get("approvalType")

    const where: Record<string, unknown> = { circleId }

    if (active === "true") {
      where.status = "ACTIVE"
      where.startsAt = { lte: new Date() }
      where.endsAt = { gte: new Date() }
    } else if (active === "false") {
      where.status = { not: "ACTIVE" }
    }

    if (delegatorMemberId) where.delegatorMemberId = delegatorMemberId
    if (delegateMemberId) where.delegateMemberId = delegateMemberId
    if (approvalType) where.approvalType = approvalType

    const delegations = await prisma.approvalDelegation.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
    })

    const delegatorIds = [...new Set(delegations.map((d) => d.delegatorMemberId))]
    const delegateIds = [...new Set(delegations.map((d) => d.delegateMemberId))]
    const allUserIds = [...new Set([...delegatorIds, ...delegateIds])]

    const users = allUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    const result = delegations.map((d) =>
      toDelegation({
        ...d,
        delegator: userMap.get(d.delegatorMemberId) ?? null,
        delegate: userMap.get(d.delegateMemberId) ?? null,
      })
    )

    return apiSuccess(result)
  } catch (error) {
    return mapServiceError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const { circleId } = await params

  const access = await requireCircleAccess(circleId)
  if ("error" in access) return access.error

  try {
    const body = await request.json()
    const parsed = createDelegationSchema.parse(body)

    const delegation = await createDelegation({
      circleId,
      delegatorMemberId: access.userId,
      delegateMemberId: parsed.delegateMemberId,
      approvalType: parsed.approvalType ?? null,
      workflowId: parsed.workflowId ?? null,
      stageId: parsed.stageId ?? null,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: new Date(parsed.endsAt),
      reason: parsed.reason ?? null,
      createdById: access.userId,
    })

    const [delegatorUser, delegateUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: access.userId },
        select: { id: true, name: true, email: true, image: true },
      }),
      prisma.user.findUnique({
        where: { id: parsed.delegateMemberId },
        select: { id: true, name: true, email: true, image: true },
      }),
    ])

    return apiCreated(
      toDelegation({
        ...delegation,
        delegator: delegatorUser,
        delegate: delegateUser,
      })
    )
  } catch (error) {
    return mapServiceError(error)
  }
}
