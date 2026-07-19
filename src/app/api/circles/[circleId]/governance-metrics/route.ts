import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { circleId } = await params

  try {
    const member = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId: session.user.id } },
    })
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()

    const [
      pendingApprovals,
      activeWorkflows,
      activeDelegations,
      overdueApprovals,
      totalRequests,
      approvedRequests,
      avgTimeResult,
    ] = await Promise.all([
      prisma.approvalRequest.count({
        where: { circleId, status: "PENDING" },
      }),
      prisma.approvalWorkflow.count({
        where: { circleId, status: "ACTIVE" },
      }),
      prisma.approvalDelegation.count({
        where: {
          circleId,
          status: "ACTIVE",
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      }),
      prisma.approvalRequest.count({
        where: {
          circleId,
          status: "PENDING",
          expiresAt: { lt: now },
        },
      }),
      prisma.approvalRequest.count({
        where: { circleId },
      }),
      prisma.approvalRequest.count({
        where: { circleId, status: "APPROVED" },
      }),
      prisma.approvalRequest.findMany({
        where: {
          circleId,
          status: { in: ["APPROVED", "REJECTED"] },
          completedAt: { not: null },
        },
        select: {
          requestedAt: true,
          completedAt: true,
        },
        take: 100,
        orderBy: { completedAt: "desc" },
      }),
    ])

    let averageApprovalTimeHours: number | null = null
    if (avgTimeResult.length > 0) {
      const totalTimeMs = avgTimeResult.reduce((sum, r) => {
        const requested = new Date(r.requestedAt).getTime()
        const completed = new Date(r.completedAt!).getTime()
        return sum + (completed - requested)
      }, 0)
      averageApprovalTimeHours = Math.round((totalTimeMs / avgTimeResult.length) / (1000 * 60 * 60) * 10) / 10
    }

    const approvalRate = totalRequests > 0
      ? Math.round((approvedRequests / totalRequests) * 100)
      : 100

    return NextResponse.json({
      pendingApprovals,
      activeWorkflows,
      activeDelegations,
      overdueApprovals,
      averageApprovalTimeHours,
      approvalRate,
    })
  } catch (error) {
    console.error("Error fetching governance metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch governance metrics" },
      { status: 500 }
    )
  }
}
