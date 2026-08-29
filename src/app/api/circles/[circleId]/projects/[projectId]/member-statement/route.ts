import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { getProjectInvestmentDashboard } from "@/lib/services/project-investment.service"
import { generateProjectMemberStatementPdf } from "@/lib/receipt/pdf-project-statement-generator"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)

    const [circle, user, dashboard] = await Promise.all([
      prisma.circle.findUnique({ where: { id: circleId }, select: { name: true, currency: true } }),
      prisma.user.findUnique({ where: { id: s.user.id }, select: { name: true, email: true } }),
      getProjectInvestmentDashboard(projectId, circleId, s.user.id),
    ])
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    const buffer = await generateProjectMemberStatementPdf({
      circleName: circle.name,
      projectName: dashboard.project.name,
      memberName: user?.name || user?.email || "Member",
      currency: circle.currency || "ZAR",
      generatedAt: new Date().toISOString().split("T")[0],
      summary: {
        invested: dashboard.myPortfolio.invested,
        ownershipPercent: dashboard.myPortfolio.ownershipPercent,
        currentValue: dashboard.myPortfolio.currentValue,
        profitLoss: dashboard.myPortfolio.profitLoss,
        roi: dashboard.myPortfolio.roi,
        distributionsReceived: dashboard.myPortfolio.distributionsReceived,
        pendingDistributions: dashboard.myPortfolio.pendingDistributions,
      },
      contributions: dashboard.myPortfolio.history.map((h) => ({
        date: h.createdAt,
        amount: h.amount,
        status: h.status.replace(/_/g, " "),
        reference: h.reference || "Capital contribution",
      })),
      distributions: dashboard.myPortfolio.distributions.map((d) => ({
        date: d.date,
        amount: d.amount,
        status: d.status.replace(/_/g, " "),
        reference: d.name,
      })),
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="project-statement-${projectId}.pdf"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}