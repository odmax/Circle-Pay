import { NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { getInvestorDashboard } from "@/lib/services/investor-relations.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const data = await getInvestorDashboard(projectId, circleId, ctx)
  return NextResponse.json(data)
}