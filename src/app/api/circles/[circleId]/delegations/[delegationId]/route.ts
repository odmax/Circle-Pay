import { NextRequest } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { apiSuccess, mapServiceError } from "@/lib/api/errors"
import { toDelegation } from "@/lib/api/dtos"
import { prisma } from "@/lib/prisma"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { revokeDelegation } from "@/lib/services/delegation.service"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ circleId: string; delegationId: string }> }
) {
  const { circleId, delegationId } = await params

  const access = await requireCircleAccess(circleId)
  if ("error" in access) return access.error

  try {
    const delegation = await prisma.approvalDelegation.findUnique({
      where: { id: delegationId },
    })

    if (!delegation || delegation.circleId !== circleId) {
      return mapServiceError(new Error("Delegation not found"))
    }

    const [delegatorUser, delegateUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: delegation.delegatorMemberId },
        select: { id: true, name: true, email: true, image: true },
      }),
      prisma.user.findUnique({
        where: { id: delegation.delegateMemberId },
        select: { id: true, name: true, email: true, image: true },
      }),
    ])

    return apiSuccess(
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ circleId: string; delegationId: string }> }
) {
  const { circleId, delegationId } = await params

  const access = await requireCircleAccess(circleId)
  if ("error" in access) return access.error

  try {
    const delegation = await prisma.approvalDelegation.findUnique({
      where: { id: delegationId },
      select: { id: true, circleId: true, delegatorMemberId: true, status: true },
    })

    if (!delegation || delegation.circleId !== circleId) {
      return mapServiceError(new Error("Delegation not found"))
    }

    if (delegation.status !== "ACTIVE") {
      return mapServiceError(new Error("Delegation is not active"))
    }

    const isDelegator = delegation.delegatorMemberId === access.userId
    if (!isDelegator) {
      const hasPermission = await hasCirclePermission({
        userId: access.userId,
        circleId,
        permission: CIRCLE_PERMISSIONS.APPROVAL_DELEGATE,
      })
      if (!hasPermission) {
        return mapServiceError(new Error("Permission denied"))
      }
    }

    const revoked = await revokeDelegation({
      delegationId,
      userId: access.userId,
    })

    return apiSuccess(toDelegation(revoked))
  } catch (error) {
    return mapServiceError(error)
  }
}
