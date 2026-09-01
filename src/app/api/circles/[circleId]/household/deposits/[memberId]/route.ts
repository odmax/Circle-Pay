import { NextRequest, NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { recordDepositPaid, finalizeDepositRefund, recordDepositRefund } from "@/lib/services/household-lease.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; memberId: string }> },
) {
  try {
    const { circleId, memberId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "paid"
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    let proofUrl: string | undefined
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      validateProofFile({ size: file.size, type: file.type, name: file.name })
      const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
      proofUrl = result.proofUrl
    }

    if (action === "paid") {
      const amount = Number(formData.get("amount"))
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })
      return NextResponse.json(await recordDepositPaid(circleId, memberId, ctx.userId, ctx.isManager, { amount, proofUrl }), { status: 201 })
    }
    if (action === "finalize") {
      if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const deductions = Number(formData.get("deductions")) || 0
      return NextResponse.json(await finalizeDepositRefund(circleId, memberId, ctx.userId, true, deductions))
    }
    if (action === "refund") {
      const amount = Number(formData.get("amount"))
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })
      return NextResponse.json(await recordDepositRefund(circleId, memberId, ctx.userId, ctx.isManager, { amount, proofUrl }), { status: 201 })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own") || message.includes("Forbidden") ? 403 : 400 })
  }
}