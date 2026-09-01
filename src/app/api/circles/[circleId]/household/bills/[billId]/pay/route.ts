import { NextRequest, NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { recordBillPayment } from "@/lib/services/household-bills.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; billId: string }> },
) {
  try {
    const { circleId, billId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const amount = Number(formData.get("amount"))
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })

    let proofUrl: string | undefined
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      validateProofFile({ size: file.size, type: file.type, name: file.name })
      const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
      proofUrl = result.proofUrl
    }

    const result = await recordBillPayment(circleId, billId, ctx.userId, ctx.isManager, {
      amount,
      payerId: (formData.get("payerId") as string) || ctx.userId,
      reference: (formData.get("reference") as string) || undefined,
      proofUrl,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("only") || message.includes("participant") ? 403 : 400 })
  }
}