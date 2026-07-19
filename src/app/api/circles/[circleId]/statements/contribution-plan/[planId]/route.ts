import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { generateContributionPlanStatementData } from "@/lib/services/statement.service"
import { generateStatementPdf, type StatementPdfData } from "@/lib/receipt/pdf-statement-generator"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; planId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, planId } = await params

    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.REPORT_VIEW,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")
    const format = searchParams.get("format") ?? "json"

    const from = fromStr ? new Date(fromStr) : undefined
    const to = toStr ? new Date(toStr) : undefined

    const data = await generateContributionPlanStatementData(circleId, planId, session.user.id, from, to)

    if (format === "pdf") {
      const allTransactions: StatementPdfData["transactions"] = []
      for (const member of data.memberSummaries) {
        for (const c of member.contributions) {
          allTransactions.push({
            date: c.date,
            type: "Contribution",
            description: `${member.member.name} — ${c.note || "Contribution"}`,
            amount: c.amount,
            direction: "inflow" as const,
            receiptNumber: c.receiptNumber,
          })
        }
      }
      allTransactions.sort((a, b) => a.date.localeCompare(b.date))

      let runningBalance = 0
      const transactionsWithBalance = allTransactions.map((tx) => {
        runningBalance += tx.direction === "inflow" ? tx.amount : -tx.amount
        return { ...tx, balance: Math.round(runningBalance * 100) / 100 }
      })

      const totalInflows = allTransactions
        .filter((tx) => tx.direction === "inflow")
        .reduce((sum, tx) => sum + tx.amount, 0)

      const statementData: StatementPdfData = {
        type: "plan",
        circleName: data.circle.name,
        circleCurrency: data.circle.currency,
        planName: data.plan.name,
        period: data.period,
        openingBalance: 0,
        totalInflows,
        totalOutflows: 0,
        closingBalance: Math.round(runningBalance * 100) / 100,
        transactions: transactionsWithBalance,
      }

      const pdfBuffer = await generateStatementPdf(statementData)

      const fileName = `plan-statement-${data.plan.name.replace(/\s+/g, "-")}-${data.period.from}-to-${data.period.to}.pdf`

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate contribution plan statement"
    const status = msg.includes("not found") ? 404 : msg.includes("Permission denied") ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
