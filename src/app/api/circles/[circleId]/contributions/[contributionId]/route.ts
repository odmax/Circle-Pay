import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  updateContribution,
  deleteContribution,
} from "@/lib/services/contribution.service"
import { updateContributionSchema } from "@/lib/validations/contributions"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, contributionId } = await params
    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, circleId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        plan: { select: { id: true, name: true, amount: true } },
        createdBy: { select: { id: true, name: true } },
        approvalRequest: {
          include: {
            requestedBy: { select: { id: true, name: true, email: true, image: true } },
            decisions: {
              include: {
                reviewer: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    })

    if (!contribution || contribution.circleId !== circleId) {
      return NextResponse.json({ error: "Contribution not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...contribution,
      amount: Number(contribution.amount),
      plan: contribution.plan
        ? { ...contribution.plan, amount: Number(contribution.plan.amount) }
        : null,
      approvalRequest: contribution.approvalRequest
        ? {
            ...contribution.approvalRequest,
            amount: contribution.approvalRequest.amount
              ? Number(contribution.approvalRequest.amount)
              : null,
          }
        : null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch contribution"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, contributionId } = await params
    const body = await req.json()

    const parsed = updateContributionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const contribution = await updateContribution(
      circleId,
      contributionId,
      session.user.id,
      parsed.data
    )
    return NextResponse.json(contribution)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update contribution"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Contribution not found"
        ? msg === "Contribution not found" ? 404 : 403
        : msg === "Correction reason is required for confirmed contributions" ||
          msg === "Cannot change status of a confirmed contribution" ||
          msg === "Cannot edit a deleted contribution"
        ? 400
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, contributionId } = await params
    await deleteContribution(circleId, contributionId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete contribution"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Contribution not found" ||
      msg === "Contribution is already deleted"
        ? msg === "Contribution not found" ? 404 : 400
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
