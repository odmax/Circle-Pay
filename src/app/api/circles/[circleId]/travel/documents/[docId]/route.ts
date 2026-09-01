import { NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { updateTravelDocument, deleteTravelDocument } from "@/lib/services/travel-document.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; docId: string }> }) {
  try {
    const { circleId, docId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const doc = await updateTravelDocument(circleId, docId, ctx.userId, await req.json().catch(() => ({})))
    return NextResponse.json(doc)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ circleId: string; docId: string }> }) {
  try {
    const { circleId, docId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const result = await deleteTravelDocument(circleId, docId, ctx.userId, ctx.isManager)
    return NextResponse.json(result)
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own") ? 403 : 400 })
  }
}