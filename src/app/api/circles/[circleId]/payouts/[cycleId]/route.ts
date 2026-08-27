import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  preparePayout,
  recordPayoutPayment,
  confirmPayoutReceived,
  skipPayout,
  deferPayout,
  swapPayoutPositions,
  uploadPayoutProof,
  reportPayoutIssue,
} from "@/lib/services/payout-rotation.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { prisma } from "@/lib/prisma"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; cycleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, cycleId } = await params
    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.PAYOUT_VIEW_ALL,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cycle = await prisma.payoutCycle.findFirst({
      where: { id: cycleId, circleId },
      include: {
        recipient: { select: { id: true, name: true, email: true, image: true } },
        payment: true,
        events: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!cycle) {
      return NextResponse.json({ error: "Payout cycle not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...cycle,
      amount: Number(cycle.amount),
      payment: cycle.payment
        ? { ...cycle.payment, amount: Number(cycle.payment.amount) }
        : null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch payout cycle"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; cycleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, cycleId } = await params
    const url = new URL(req.url)
    const action = url.searchParams.get("action")

    if (action === "prepare") {
      const result = await preparePayout(circleId, cycleId, session.user.id)
      return NextResponse.json(result)
    }

    if (action === "record") {
      const body = await req.json().catch(() => ({}))
      const result = await recordPayoutPayment(circleId, cycleId, session.user.id, body)
      return NextResponse.json(result)
    }

    if (action === "confirm") {
      const result = await confirmPayoutReceived(circleId, cycleId, session.user.id)
      return NextResponse.json(result)
    }

    if (action === "skip") {
      const body = await req.json().catch(() => ({}))
      const reason = body.reason
      if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 })
      const result = await skipPayout(circleId, cycleId, session.user.id, reason)
      return NextResponse.json(result)
    }

    if (action === "defer") {
      const body = await req.json().catch(() => ({}))
      const reason = body.reason
      if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 })
      const result = await deferPayout(circleId, cycleId, session.user.id, reason, body.toCycleNumber)
      return NextResponse.json(result)
    }

    if (action === "swap") {
      const body = await req.json().catch(() => ({}))
      const reason = body.reason
      const toCycleId = body.toCycleId
      if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 })
      if (!toCycleId) return NextResponse.json({ error: "Target cycle is required" }, { status: 400 })
      const result = await swapPayoutPositions(circleId, cycleId, toCycleId, session.user.id, reason)
      return NextResponse.json(result)
    }

    if (action === "report-issue") {
      const body = await req.json().catch(() => ({}))
      const description = body.description
      if (!description) return NextResponse.json({ error: "A description is required" }, { status: 400 })
      const result = await reportPayoutIssue(circleId, cycleId, session.user.id, description)
      return NextResponse.json(result)
    }

    if (action === "upload-proof") {
      const form = await req.formData()
      const file = form.get("file") as File | null
      const proofReference = form.get("proofReference") as string | null

      if (!file) return NextResponse.json({ error: "Proof file is required" }, { status: 400 })

      try {
        validateProofFile({ size: file.size, type: file.type, name: file.name })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid proof file"
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const upload = await uploadProofImage(buffer, file.name, session.user.id)
      const result = await uploadPayoutProof(
        circleId,
        cycleId,
        session.user.id,
        upload.proofUrl,
        proofReference
      )
      return NextResponse.json({ ...result, proofUrl: upload.proofUrl })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    const forbidden =
      msg === "Forbidden" ||
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Only the beneficiary or an authorised member can confirm receipt" ||
      msg === "Only the beneficiary or an authorised member can report an issue"
    if (forbidden) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
