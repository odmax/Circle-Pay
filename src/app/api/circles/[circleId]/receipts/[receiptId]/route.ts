import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getReceiptById } from "@/lib/services/receipt.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; receiptId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, receiptId } = await params

    const receipt = await getReceiptById(receiptId)
    if (!receipt || receipt.circleId !== circleId) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    const isOwner = receipt.issuedToUserId === session.user.id
    if (!isOwner) {
      const canView = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.REPORT_VIEW,
      })
      if (!canView) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(receipt)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch receipt"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
