import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getProjectDistributionDashboard } from "@/lib/services/project-distribution.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getProjectDistributionDashboard((await params).projectId))
}
