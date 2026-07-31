import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  updateContribution,
  deleteContribution,
  confirmContribution,
  rejectContribution,
} from "@/lib/services/contribution.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { verifyContributionProof, applyVerificationResult } from "@/lib/services/proof-verification.service"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification } from "@/lib/services/notification.service"
import { updateContributionSchema } from "@/lib/validations/contributions"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; contributionId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId, contributionId } = await params
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || url.pathname.split("/").pop()

    if (action === "upload-proof") {
      const form = await req.formData()
      const file = form.get("file") as File | null
      const proofReference = form.get("proofReference") as string | null
      const paymentMethod = form.get("paymentMethod") as string | null
      const contributionMonth = form.get("contributionMonth") as string | null

      if (!file) return NextResponse.json({ error: "Proof file is required" }, { status: 400 })

      try {
        validateProofFile({ size: file.size, type: file.type, name: file.name })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid proof file"
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      const existing = await prisma.contribution.findFirst({
        where: { id: contributionId, circleId },
      })
      if (!existing) return NextResponse.json({ error: "Contribution not found" }, { status: 404 })

      const upload = await uploadProofImage(buffer, file.name, session.user.id)

      await prisma.contribution.update({
        where: { id: contributionId, circleId },
        data: {
          proofUrl: upload.proofUrl,
          proofReference: proofReference || undefined,
          paymentMethod: paymentMethod || undefined,
          contributionMonth: contributionMonth || undefined,
          status: "PROOF_SUBMITTED",
        } as any,
      })

      createAuditLog({
        userId: session.user.id,
        circleId,
        action: "PROOF_UPLOADED",
        entityType: "Contribution",
        entityId: contributionId,
        newValues: { proofUrl: upload.proofUrl, paymentMethod: paymentMethod || null, contributionMonth: contributionMonth || null },
      }).catch(() => {})

      createNotification({
        userId: existing.userId,
        circleId,
        type: "CONTRIBUTION_MADE",
        title: "Proof received",
        message: "Your proof of payment has been received and is being verified",
        link: `/circles/${circleId}/contributions`,
      }).catch(() => {})

      return NextResponse.json({ success: true, proofUrl: upload.proofUrl })
    }

    if (action === "verify") {
      const contribution = await prisma.contribution.findFirst({
        where: { id: contributionId, circleId },
      })
      if (!contribution) return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (!contribution.proofUrl) return NextResponse.json({ error: "No proof uploaded yet" }, { status: 400 })

      const result = await verifyContributionProof({
        contributionId, circleId,
        proofUrl: contribution.proofUrl,
        proofReference: contribution.proofReference ?? undefined,
        amount: Number(contribution.amount),
        contributionMonth: contribution.contributionMonth ?? undefined,
      })

      await applyVerificationResult(contributionId, result)

      const notificationType = result.status === "VERIFIED"
        ? "CONTRIBUTION_MADE" as any
        : result.status === "NEEDS_REVIEW"
        ? "APPROVAL_STAGE_ACTIVATED" as any
        : "APPROVAL_ESCALATED" as any

      createAuditLog({
        userId: session.user.id,
        circleId,
        action: "PROOF_VERIFICATION_COMPLETED",
        entityType: "Contribution",
        entityId: contributionId,
        newValues: {
          verificationStatus: result.status,
          confidenceScore: result.confidenceScore,
          extractedAmount: result.extractedAmount,
          extractedDate: result.extractedDate,
          extractedReference: result.extractedReference,
          extractedSender: result.extractedSender,
          reason: result.reason,
        },
      }).catch(() => {})

      createNotification({
        userId: contribution.userId,
        circleId,
        type: notificationType,
        title: result.status === "VERIFIED"
          ? "Contribution auto-verified"
          : result.status === "NEEDS_REVIEW"
          ? "Contribution needs review"
          : "Contribution verification failed",
        message: result.reason,
        link: `/circles/${circleId}/contributions`,
      }).catch(() => {})

      return NextResponse.json(result)
    }

    if (action === "approve") {
      const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_ANY })
      if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const target = await prisma.contribution.findFirst({
        where: { id: contributionId, circleId },
      })
      if (!target) return NextResponse.json({ error: "Contribution not found" }, { status: 404 })

      await prisma.contribution.update({
        where: { id: contributionId, circleId },
        data: {
          status: "CONFIRMED",
          verifiedById: session.user.id,
          verifiedAt: new Date(),
        } as any,
      })

      try { await confirmContribution(circleId, contributionId, session.user.id) }
      catch { /* contribution may already be confirmed */ }

      createAuditLog({
        userId: session.user.id,
        circleId,
        action: "CONTRIBUTION_APPROVED",
        entityType: "Contribution",
        entityId: contributionId,
        newValues: { verifiedById: session.user.id, verifiedAt: new Date().toISOString() },
      }).catch(() => {})

      createNotification({
        userId: target.userId,
        circleId,
        type: "CONTRIBUTION_MADE",
        title: "Contribution approved",
        message: "Your contribution has been approved",
        link: `/circles/${circleId}/contributions`,
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    if (action === "reject") {
      const canManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.APPROVAL_REVIEW_ANY })
      if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const target = await prisma.contribution.findFirst({
        where: { id: contributionId, circleId },
      })
      if (!target) return NextResponse.json({ error: "Contribution not found" }, { status: 404 })

      const body = await req.json().catch(() => ({}))
      const reason = body.reason || "Rejected by admin"

      await prisma.contribution.update({
        where: { id: contributionId, circleId },
        data: {
          status: "REJECTED",
          rejectedById: session.user.id,
          rejectedAt: new Date(),
          rejectionReason: reason,
        } as any,
      })

      try { await rejectContribution(circleId, contributionId, session.user.id, reason) }
      catch { /* already rejected */ }

      createAuditLog({
        userId: session.user.id,
        circleId,
        action: "CONTRIBUTION_REJECTED",
        entityType: "Contribution",
        entityId: contributionId,
        newValues: { rejectedById: session.user.id, rejectedAt: new Date().toISOString(), rejectionReason: reason },
      }).catch(() => {})

      createNotification({
        userId: target.userId,
        circleId,
        type: "APPROVAL_ESCALATED",
        title: "Contribution rejected",
        message: reason,
        link: `/circles/${circleId}/contributions`,
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

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
