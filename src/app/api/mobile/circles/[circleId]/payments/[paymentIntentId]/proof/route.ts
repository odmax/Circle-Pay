import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"

export async function POST(req: Request, { params }: { params: Promise<{ paymentIntentId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req)
    const { paymentIntentId } = await params
    const { proofReference } = await req.json().catch(() => ({}))
    const intent = await prisma.circlePaymentIntent.findUnique({ where: { id: paymentIntentId } })
    if (!intent || intent.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.circlePaymentIntent.update({ where: { id: paymentIntentId }, data: { status: "PROOF_SUBMITTED", proofReference: proofReference || null } })
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e.message || "Unauthorized" }, { status: 401 }) }
}
