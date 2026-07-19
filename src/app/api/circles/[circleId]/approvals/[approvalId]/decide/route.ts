import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { approveRequest, rejectRequest } from "@/lib/services/approval.service"
import { confirmContribution, rejectContribution } from "@/lib/services/contribution.service"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, approvalId } = await params
    const body = await req.json()
    const { decision, comment } = body as {
      decision?: "APPROVE" | "REJECT"
      comment?: string
    }

    if (!decision || (decision !== "APPROVE" && decision !== "REJECT")) {
      return NextResponse.json({ error: "decision must be APPROVE or REJECT" }, { status: 400 })
    }

    const canReview = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CONTRIBUTION_REVIEW,
    })
    if (!canReview) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      select: { id: true, circleId: true, type: true, status: true },
    })
    if (!approval || approval.circleId !== circleId) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 })
    }

    let result
    if (decision === "APPROVE") {
      result = await approveRequest({
        approvalRequestId: approvalId,
        reviewerId: session.user.id,
        comment,
      })
    } else {
      result = await rejectRequest({
        approvalRequestId: approvalId,
        reviewerId: session.user.id,
        comment,
      })
    }

    if (approval.type === "CONTRIBUTION") {
      const metadata = (result.request?.metadata ?? result.request) as Record<string, unknown> | null
      const contributionId =
        (metadata as Record<string, unknown>)?.contributionId ??
        (result.request as Record<string, unknown>)?.resourceId

      const reachedMinimum = "reachedMinimum" in result && (result as { reachedMinimum: boolean }).reachedMinimum

      if (contributionId) {
        if (decision === "APPROVE" && reachedMinimum) {
          try {
            await confirmContribution(circleId, contributionId as string, session.user.id)
          } catch {
            // Contribution may already be confirmed or not in PENDING_REVIEW state
          }
        } else if (decision === "REJECT") {
          try {
            await rejectContribution(
              circleId,
              contributionId as string,
              session.user.id,
              comment ?? null
            )
          } catch {
            // Contribution may already be processed
          }
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to process decision"
    const status = msg.includes("not found")
      ? 404
      : msg.includes("already voted")
        ? 409
        : msg.includes("expired")
          ? 410
          : msg.includes("Permission denied")
            ? 403
            : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
