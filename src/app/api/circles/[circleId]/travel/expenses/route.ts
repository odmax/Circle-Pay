import { NextRequest, NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { createTravelExpense } from "@/lib/services/travel-finance.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> },
) {
  try {
    const { circleId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.EXPENSE_CREATE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const paidById = (formData.get("paidById") as string) || ctx.userId
    if (!ctx.isManager && paidById !== ctx.userId) return NextResponse.json({ error: "You can only record expenses you paid yourself" }, { status: 403 })

    let receiptUrl: string | undefined
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      validateProofFile({ size: file.size, type: file.type, name: file.name })
      const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
      receiptUrl = result.proofUrl
    }

    const amount = Number(formData.get("amount"))
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })

    let participantIds: string[] = []
    const rawP = formData.get("participantIds") as string | null
    if (rawP) { try { const arr = JSON.parse(rawP); if (Array.isArray(arr)) participantIds = arr.filter((x) => typeof x === "string") } catch { /* ignore */ } }

    let splitsDetail: Array<{ userId: string; amount?: number; percentage?: number }> | undefined
    const rawS = formData.get("splitsDetail") as string | null
    if (rawS) { try { const arr = JSON.parse(rawS); if (Array.isArray(arr)) splitsDetail = arr } catch { /* ignore */ } }

    const expense = await createTravelExpense(circleId, ctx.userId, {
      title: (formData.get("title") as string) || "Travel expense",
      amount,
      category: (formData.get("category") as string) || "OTHER",
      expenseDate: (formData.get("expenseDate") as string) || new Date().toISOString(),
      paidById,
      receiptUrl,
      travelItemId: (formData.get("travelItemId") as string) || null,
      participantIds,
      splitType: (formData.get("splitType") as "EQUAL" | "EXACT" | "PERCENTAGE") || "EQUAL",
      splitsDetail,
    })
    return NextResponse.json(expense, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}