import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { generateCircleStatementData } from "@/lib/services/statement.service"
import { generateStatementPdf, type StatementPdfData } from "@/lib/receipt/pdf-statement-generator"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params

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

    const data = await generateCircleStatementData(circleId, session.user.id, from, to)

    if (format === "pdf") {
      const statementData: StatementPdfData = {
        type: "circle",
        circleName: data.circle.name,
        circleCurrency: data.circle.currency,
        period: data.period,
        openingBalance: data.openingBalance,
        totalInflows: data.totalInflows,
        totalOutflows: data.totalOutflows,
        closingBalance: data.closingBalance,
        transactions: data.transactions.map((tx) => ({
          date: tx.date,
          type: tx.type,
          description: tx.description,
          amount: tx.inflow > 0 ? tx.inflow : tx.outflow,
          direction: tx.inflow > 0 ? "inflow" as const : "outflow" as const,
          receiptNumber: tx.receiptNumber,
        })),
      }

      const pdfBuffer = await generateStatementPdf(statementData)

      const fileName = `circle-statement-${data.period.from}-to-${data.period.to}.pdf`

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate circle statement"
    const status = msg.includes("not found") ? 404 : msg.includes("Permission denied") ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
