import { NextRequest, NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { createTravelSettlement } from "@/lib/services/travel-finance.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> },
) {
  try {
    const { circleId } = await params
    const ctx = await getTravelCtx(circleId)
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

    const settlement = await createTravelSettlement(circleId, ctx.userId, {
      debtorId: (formData.get("debtorId") as string) || "",
      creditorId: (formData.get("creditorId") as string) || "",
      amount,
      note: (formData.get("note") as string) || undefined,
      proofUrl,
    })
    return NextResponse.json(settlement, { status: 201 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("debtor or creditor") ? 403 : 400 })
  }
}