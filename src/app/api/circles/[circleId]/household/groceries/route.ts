import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { getGroceriesSummary, listSharedPurchases, getGroceryRuns } from "@/lib/services/household-purchase.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getHouseholdCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const [purchases, runs, summary] = await Promise.all([
    listSharedPurchases(circleId, ctx.userId),
    getGroceryRuns(circleId, ctx.userId),
    getGroceriesSummary(circleId, ctx.userId),
  ])
  return NextResponse.json({ purchases: purchases.purchases, runs, summary, isManager: ctx.isManager })
}