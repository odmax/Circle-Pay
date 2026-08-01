import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCircleById } from "@/lib/services/circle.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getCircleInsightsWithStatus } from "@/lib/services/ai-insight.service"
import { getOrComputeHealth } from "@/lib/services/finance-health.service"
import { generatePredictions } from "@/lib/services/finance-health.service"
import { runFinancialAnalysis } from "@/lib/services/finance-insight.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const hasAI = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.AI_VIEW })
  if (!hasAI) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") as string | null

  const [insights, health] = await Promise.all([
    getCircleInsightsWithStatus(circleId, session.user.id, status as any),
    getOrComputeHealth(circleId),
  ])

  return NextResponse.json({ insights, health })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { circleId } = await params
  const hasManage = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.AI_MANAGE })
  if (!hasManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { insights, healthScore, rating, predictions } = await runFinancialAnalysis(circleId, session.user.id)

  return NextResponse.json({ insights, healthScore, rating, predictions }, { status: 201 })
}