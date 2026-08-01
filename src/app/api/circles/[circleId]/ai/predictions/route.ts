import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { generatePredictions } from "@/lib/services/finance-health.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { circleId } = await params
  const hasAI = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.AI_VIEW })
  if (!hasAI) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const predictions = await generatePredictions(circleId)
  return NextResponse.json(predictions)
}