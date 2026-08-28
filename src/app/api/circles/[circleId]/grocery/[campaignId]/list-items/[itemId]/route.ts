import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateListItem, removeListItem } from "@/lib/services/grocery.service"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ circleId: string; itemId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, itemId } = await params
  try {
    const body = await req.json()
    const item = await updateListItem(circleId, itemId, session.user.id, {
      product: body.product,
      category: body.category,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      unit: body.unit,
      estimatedPrice: body.estimatedPrice != null ? Number(body.estimatedPrice) : undefined,
      notes: body.notes,
    })
    return NextResponse.json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update list item"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ circleId: string; itemId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, itemId } = await params
  try {
    const res = await removeListItem(circleId, itemId, session.user.id)
    return NextResponse.json(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove list item"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
