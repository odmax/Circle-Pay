import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { replaceReceipt } from "@/lib/services/receipt.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; receiptId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, receiptId } = await params

    const canAdjust = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.LEDGER_ADJUST,
    })
    if (!canAdjust) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { reason } = body as { reason?: string }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

    const receipt = await replaceReceipt(receiptId, session.user.id, reason.trim())

    return NextResponse.json(receipt)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to replace receipt"
    const status = msg.includes("not found") ? 404 : msg.includes("Only active") ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
