import { NextRequest, NextResponse } from "next/server"
import { sweepOpportunityReminders } from "@/lib/services/opportunity.service"
import { sweepCapitalCallReminders } from "@/lib/services/capital-call.service"
import { sweepTravelItineraryReminders } from "@/lib/services/travel-itinerary.service"
import { sweepTravelDocumentAlerts } from "@/lib/services/travel-document.service"
import { sweepHouseholdBills } from "@/lib/services/household-bills.service"
import { sweepHouseholdChores } from "@/lib/services/household-chores.service"
import { prisma } from "@/lib/prisma"

// Daily sweep: closing-soon opportunities and overdue capital calls. Guarded by
// CRON_SECRET exactly like the other cron routes; fails closed when unset.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const circles = await prisma.circle.findMany({ where: { deletedAt: null }, select: { id: true } })
    const results: Record<string, string[]> = {}
    for (const c of circles) {
      const [oppResult, callResult, travelResult, docResult, houseResult, choreResult] = await Promise.all([
        sweepOpportunityReminders(c.id).catch(() => [] as string[]),
        sweepCapitalCallReminders(c.id).catch(() => [] as string[]),
        sweepTravelItineraryReminders(c.id).catch(() => [] as string[]),
        sweepTravelDocumentAlerts(c.id).catch(() => [] as string[]),
        sweepHouseholdBills(c.id).catch(() => [] as string[]),
        sweepHouseholdChores(c.id).catch(() => [] as string[]),
      ])
      results[c.id] = [...oppResult, ...callResult, ...travelResult, ...docResult, ...houseResult, ...choreResult]
    }
    return NextResponse.json({ results })
  } catch (error) {
    console.error("Opportunity/capital-call reminder sweep error:", error)
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 })
  }
}