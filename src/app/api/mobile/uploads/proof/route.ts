import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(req: Request) {
  try {
    const user = await getMobileUserFromRequest(req)
    const contentType = req.headers.get("content-type") || ""

    // Multipart form upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      const paymentIntentId = formData.get("paymentIntentId") as string
      const circleId = formData.get("circleId") as string
      const proofReference = formData.get("proofReference") as string || null

      if (!file || !paymentIntentId) return NextResponse.json({ error: "File and paymentIntentId required" }, { status: 400 })

      // Verify ownership
      const intent = await prisma.circlePaymentIntent.findUnique({ where: { id: paymentIntentId } })
      if (!intent || intent.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 })

      // Validate file
      const buffer = Buffer.from(await file.arrayBuffer())
      validateProofFile({ size: file.size, type: file.type, name: file.name })

      // Upload
      const result = await uploadProofImage(buffer, file.name, user.id)

      // Update payment intent
      await prisma.circlePaymentIntent.update({
        where: { id: paymentIntentId },
        data: { status: "PROOF_SUBMITTED", proofUrl: result.proofUrl, proofReference: proofReference || null },
      })

      return NextResponse.json(result, { status: 201 })
    }

    // JSON fallback (proofReference only, no file)
    const { proofReference, paymentIntentId } = await req.json().catch(() => ({}))
    if (paymentIntentId && proofReference) {
      const intent = await prisma.circlePaymentIntent.findUnique({ where: { id: paymentIntentId } })
      if (!intent || intent.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
      await prisma.circlePaymentIntent.update({ where: { id: paymentIntentId }, data: { status: "PROOF_SUBMITTED", proofReference } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "No file or proof reference provided" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 400 })
  }
}
