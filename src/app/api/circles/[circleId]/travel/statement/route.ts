/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { getTravelCtx } from "@/lib/api/travel-ctx"
import { prisma } from "@/lib/prisma"
import { getMyFinalStatement } from "@/lib/services/travel-close.service"
import { generateTravelStatementPdf } from "@/lib/receipt/pdf-travel-statement-generator"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getTravelCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const url = new URL(req.url)
    const memberId = url.searchParams.get("memberId")

    let data: any
    if (memberId && ctx.isManager) {
      const trip = await prisma.travelTrip.findFirst({ where: { id: ctx.tripId, circleId } })
      const member = await prisma.circleMember.findFirst({ where: { circleId, userId: memberId }, include: { user: { select: { name: true } } } })
      if (!trip || !member) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const snapshot = await prisma.travelStatementSnapshot.findUnique({ where: { tripId_userId: { tripId: ctx.tripId, userId: memberId } } })
      data = { trip, statement: snapshot ? { ...(snapshot.data as any), name: snapshot.name } : null }
    } else {
      data = await getMyFinalStatement(circleId, ctx.tripId, ctx.userId)
    }
    if (!data?.statement) return NextResponse.json({ error: "Statement not available yet — finalize the trip first" }, { status: 404 })

    const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true, currency: true } })
    const s = data.statement
    const buffer = await generateTravelStatementPdf({
      circleName: circle?.name || "Travel circle",
      tripName: data.trip.name,
      destination: data.trip.destination,
      startDate: data.trip.startDate,
      endDate: data.trip.endDate,
      memberName: s.name || memberId || "Member",
      currency: circle?.currency || "ZAR",
      totals: { totalSpent: s.totalSpent || 0, totalContributions: s.totalContributions || 0, perPersonCost: s.perPersonCost || 0, variance: s.variance || 0, remainingFunds: s.remainingFunds || 0 },
      row: { contributions: s.contributions || 0, memberPaidExpenses: s.memberPaidExpenses || 0, share: s.share || 0, settledGiven: s.settledGiven || 0, settledReceived: s.settledReceived || 0, refundAvailable: s.refundAvailable || 0, finalBalance: s.finalBalance || 0 },
    })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="trip-statement-${data.trip.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"` },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}