import { NextRequest, NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { createSharedPurchase, listSharedPurchases } from "@/lib/services/household-purchase.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getHouseholdCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json({ purchases: (await listSharedPurchases(circleId, ctx.userId)).purchases })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> },
) {
  try {
    const { circleId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const payerId = (formData.get("paidById") as string) || ctx.userId
    if (!ctx.isManager && payerId !== ctx.userId) return NextResponse.json({ error: "You can only record purchases you paid for yourself" }, { status: 403 })

    let receiptUrl: string | undefined
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      validateProofFile({ size: file.size, type: file.type, name: file.name })
      const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
      receiptUrl = result.proofUrl
    }

    let participantIds: string[] = []
    const rawP = formData.get("participantIds") as string | null
    if (rawP) { try { const arr = JSON.parse(rawP); if (Array.isArray(arr)) participantIds = arr.filter((x) => typeof x === "string") } catch { /* ignore */ } }
    let splitConfig: Array<{ userId: string; amount?: number; percentage?: number }> | null = null
    const rawS = formData.get("splitConfig") as string | null
    if (rawS) { try { const arr = JSON.parse(rawS); if (Array.isArray(arr)) splitConfig = arr } catch { /* ignore */ } }

    const purchase = await createSharedPurchase(circleId, ctx.userId, ctx.isManager, {
      title: (formData.get("title") as string) || "Shared purchase",
      category: (formData.get("category") as string) || "GROCERIES",
      store: (formData.get("store") as string) || null,
      amount: Number(formData.get("amount")),
      purchaseDate: (formData.get("purchaseDate") as string) || null,
      paidById: payerId,
      participantIds,
      splitType: (formData.get("splitType") as string) || "EQUAL",
      splitConfig,
      notes: (formData.get("notes") as string) || null,
      receiptUrl,
      runId: (formData.get("runId") as string) || null,
    })
    return NextResponse.json(purchase, { status: 201 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("paid for") ? 403 : 400 })
  }
}