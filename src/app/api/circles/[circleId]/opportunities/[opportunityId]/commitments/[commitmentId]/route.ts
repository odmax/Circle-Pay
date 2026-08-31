import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { submitOpportunityProof, approveCommitment, rejectCommitment, withdrawCommitment } from "@/lib/services/opportunity.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; opportunityId: string; commitmentId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, opportunityId, commitmentId } = await params

  const commitment = await prisma.investmentOpportunityCommitment.findUnique({
    where: { id: commitmentId },
    include: { opportunity: { select: { circleId: true } } },
  })
  if (!commitment || commitment.opportunity.circleId !== circleId || commitment.opportunityId !== opportunityId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "proof"

  try {
    if (action === "proof") {
      // Members only submit proof for their own commitment.
      if (commitment.userId !== s.user.id) return NextResponse.json({ error: "You can only submit proof for your own commitment" }, { status: 403 })
      let proofUrl: string | undefined
      let reference: string | undefined
      const contentType = req.headers.get("content-type") || ""
      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        reference = (formData.get("reference") as string) || undefined
        if (file && file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer())
          validateProofFile({ size: file.size, type: file.type, name: file.name })
          const result = await uploadProofImage(buffer, file.name, s.user.id, circleId)
          proofUrl = result.proofUrl
        }
      } else {
        const body = await req.json().catch(() => ({}))
        reference = body.reference || undefined
      }
      if (!proofUrl && !reference) return NextResponse.json({ error: "A proof file or reference is required" }, { status: 400 })
      return NextResponse.json(await submitOpportunityProof(circleId, commitmentId, s.user.id, { proofUrl, reference }))
    }

    if (action === "withdraw") {
      if (commitment.userId !== s.user.id) return NextResponse.json({ error: "You can only withdraw your own commitment" }, { status: 403 })
      return NextResponse.json(await withdrawCommitment(circleId, commitmentId, s.user.id))
    }

    const canApprove = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_APPROVE })
    if (!canApprove) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (action === "confirm") {
      return NextResponse.json(await approveCommitment(circleId, commitmentId, s.user.id))
    }
    if (action === "reject") {
      const body = await req.json().catch(() => ({}))
      return NextResponse.json(await rejectCommitment(circleId, commitmentId, s.user.id, body.reason))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own") || message.includes("self") ? 403 : 400 })
  }
}