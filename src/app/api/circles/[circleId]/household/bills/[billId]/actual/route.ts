import { NextRequest, NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { recordBillActual } from "@/lib/services/household-bills.service"
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
    const actualAmount = Number(formData.get("actualAmount"))
    if (!Number.isFinite(actualAmount) || actualAmount < 0) return NextResponse.json({ error: "A valid actual amount is required" }, { status: 400 })

    let fileUrl: string | undefined
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      validateProofFile({ size: file.size, type: file.type, name: file.name })
      const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
      fileUrl = result.proofUrl
    }

    const updated = await recordBillActual(circleId, billId, ctx.userId, ctx.isManager, {
      actualAmount,
      meter: (formData.get("meter") as string) || undefined,
      fileUrl,
    })
    return NextResponse.json(updated, { status: 201 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("responsible") ? 403 : 400 })
  }
}