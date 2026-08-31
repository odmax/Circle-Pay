import { NextRequest, NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { addBookingDocument } from "@/lib/services/travel-itinerary.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; itemId: string }> },
) {
  try {
    const { circleId, itemId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const bookingId = (formData.get("bookingId") as string) || null
    if (!file || file.size === 0) return NextResponse.json({ error: "A file is required" }, { status: 400 })

    let targetBookingId = bookingId
    if (!targetBookingId) {
      const booking = await prisma.travelBooking.findFirst({ where: { itineraryItemId: itemId, circleId } })
      if (!booking) return NextResponse.json({ error: "No booking on this item. Create the booking first." }, { status: 400 })
      targetBookingId = booking.id
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    validateProofFile({ size: file.size, type: file.type, name: file.name })
    const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
    const doc = await addBookingDocument(circleId, targetBookingId, ctx.userId, { name: file.name, url: result.proofUrl, mimeType: file.type, size: file.size })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}