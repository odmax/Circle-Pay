import { NextRequest, NextResponse } from "next/server"
import { runContributionJobs } from "@/lib/services/contribution-schedule.service"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronToken = request.headers.get("x-cron-token")
  const queryToken = new URL(request.url).searchParams.get("token")
  const allowed = process.env.CRON_SECRET
    ? authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      cronToken === process.env.CRON_SECRET ||
      queryToken === process.env.CRON_SECRET
    : true

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runContributionJobs()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Contribution scheduler error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduler failed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
