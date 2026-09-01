import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { getMonthlyBillsSummary, periodOf, ensureBillGeneration, createRecurringBill } from "@/lib/services/household-bills.service"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getHouseholdCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const url = new URL(req.url)
  const period = url.searchParams.get("period") || periodOf(new Date())
  await ensureBillGeneration(circleId)
  const recurring = await prisma.householdRecurringBill.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } })
  const summary = await getMonthlyBillsSummary(circleId, period, ctx.userId)
  return NextResponse.json({ recurring, summary, isManager: ctx.isManager })
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await createRecurringBill(circleId, ctx.userId, body), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}