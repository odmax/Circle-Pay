import { NextResponse } from "next/server"
import { runDueAutomations } from "@/lib/services/automation.service"

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  const token = new URL(req.url).searchParams.get("token") || req.headers.get("x-cron-token")
  // Fail closed: if CRON_SECRET is not configured, never authorize this endpoint.
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runDueAutomations()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
