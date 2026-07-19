import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getCircleReceipts } from "@/lib/services/receipt.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params

    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") as string | null
    const status = searchParams.get("status") as string | null
    const search = searchParams.get("search") as string | null
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined

    const result = await getCircleReceipts(circleId, {
      type: (type as "CONTRIBUTION" | "EXPENSE" | "SETTLEMENT" | "WALLET_DEPOSIT" | "WALLET_WITHDRAWAL" | "WALLET_TRANSFER" | "PROJECT_PAYMENT" | "GOAL_ALLOCATION" | "OTHER") ?? undefined,
      status: (status as "ACTIVE" | "VOIDED" | "REPLACED") ?? undefined,
      search: search ?? undefined,
      limit,
      offset,
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch receipts"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
