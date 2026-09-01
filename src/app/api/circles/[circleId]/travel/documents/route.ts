import { NextRequest, NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { listTravelDocuments, addTravelDocument } from "@/lib/services/travel-document.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getTravelCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json(await listTravelDocuments(circleId, ctx.tripId, ctx.userId, ctx.isManager))
}

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
    if (!file || file.size === 0) return NextResponse.json({ error: "A document file is required" }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    validateProofFile({ size: file.size, type: file.type, name: file.name })
    const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)

    const ownerUserId = (formData.get("ownerUserId") as string) || ctx.userId
    if (!ctx.isManager && ownerUserId !== ctx.userId) return NextResponse.json({ error: "You can only upload your own travel documents" }, { status: 403 })

    const doc = await addTravelDocument(circleId, ctx.tripId, ctx.userId, {
      ownerUserId,
      type: (formData.get("type") as string) || "OTHER",
      name: (formData.get("name") as string) || file.name,
      url: result.proofUrl,
      mimeType: file.type,
      size: file.size,
      expiryDate: (formData.get("expiryDate") as string) || null,
      relatedItemId: (formData.get("relatedItemId") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}