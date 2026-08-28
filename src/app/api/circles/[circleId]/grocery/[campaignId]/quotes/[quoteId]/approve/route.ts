import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { approveSupplierQuote } from "@/lib/services/grocery.service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ circleId: string; quoteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, quoteId } = await params
  try {
    const quote = await approveSupplierQuote(circleId, quoteId, session.user.id)
    return NextResponse.json({ quote })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve supplier"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
