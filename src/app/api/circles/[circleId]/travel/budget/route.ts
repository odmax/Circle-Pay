import { NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { getTravelFinances, TRAVEL_BUDGET_CATEGORIES } from "@/lib/services/travel-finance.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getTravelCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json(await getTravelFinances(circleId, ctx.tripId, ctx.userId))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    const raw: Record<string, number> = body.budgetByCategory || {}
    const budgetByCategory: Record<string, number> = {}
    for (const c of TRAVEL_BUDGET_CATEGORIES) {
      const v = Number(raw[c])
      budgetByCategory[c] = Number.isFinite(v) && v > 0 ? v : 0
    }
    const trip = await prisma.travelTrip.update({ where: { circleId }, data: { budgetByCategory } })
    await createAuditLog({ userId: ctx.userId, circleId, action: "TRAVEL_BUDGET_UPDATED", entityType: "TravelTrip", entityId: trip.id, newValues: { budgetByCategory } })
    return NextResponse.json({ budgetByCategory })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}