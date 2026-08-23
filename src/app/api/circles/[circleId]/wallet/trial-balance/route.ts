import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleTrialBalance } from "@/lib/services/wallet.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.LEDGER_VIEW })
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const balance = await getCircleTrialBalance(circleId)
  return NextResponse.json(balance)
}
