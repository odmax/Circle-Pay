import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserReceipts } from "@/lib/services/receipt.service"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const circleId = searchParams.get("circleId") ?? undefined

    const receipts = await getUserReceipts(session.user.id, circleId)

    return NextResponse.json({ receipts })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch receipts"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
