import { NextResponse } from "next/server"
import { runDueAutomations } from "@/lib/services/automation.service"

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || req.headers.get("x-cron-token")
  if (token !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runDueAutomations()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
