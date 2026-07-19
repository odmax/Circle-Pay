import PDFDocument from "pdfkit"
import { CURRENCIES, APP_NAME } from "@/lib/constants"

export interface StatementPdfData {
  type: "member" | "circle" | "plan"
  circleName: string
  circleCurrency: string
  memberName?: string
  planName?: string
  period: { from: string; to: string }
  openingBalance: number
  totalInflows: number
  totalOutflows: number
  closingBalance: number
  transactions: Array<{
    date: string
    type: string
    description: string
    amount: number
    direction: "inflow" | "outflow"
    receiptNumber?: string
    balance?: number
  }>
}

function getCurrencySymbol(currencyCode: string): string {
  const found = CURRENCIES.find((c) => c.code === currencyCode)
  return found?.symbol ?? currencyCode
}

function formatAmount(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol}${formatted}`
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + "…"
}

function getTitle(data: StatementPdfData): string {
  switch (data.type) {
    case "member":
      return `Member Statement — ${data.memberName ?? "Unknown"}`
    case "circle":
      return "Circle Statement"
    case "plan":
      return `Contribution Plan Statement — ${data.planName ?? "Unknown"}`
  }
}

export async function generateStatementPdf(data: StatementPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
      bufferPages: true,
      info: {
        Title: `Statement — ${data.circleName}`,
        Author: APP_NAME,
        Subject: getTitle(data),
      },
    })

    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width
    const marginLeft = 45
    const marginRight = 45
    const contentWidth = pageWidth - marginLeft - marginRight
    let y = 45

    function checkPage(needed: number) {
      if (y + needed > doc.page.height - 60) {
        doc.addPage()
        y = 45
      }
    }

    // ── Header ──
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#111827")
    doc.text(APP_NAME, marginLeft, y, { align: "center", width: contentWidth })
    y += 28

    doc.fontSize(12).font("Helvetica").fillColor("#6b7280")
    doc.text(getTitle(data), marginLeft, y, { align: "center", width: contentWidth })
    y += 18

    doc.fontSize(10).font("Helvetica").fillColor("#374151")
    doc.text(data.circleName, marginLeft, y, { align: "center", width: contentWidth })
    y += 14

    doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
    doc.text(`Period: ${data.period.from} to ${data.period.to}`, marginLeft, y, {
      align: "center",
      width: contentWidth,
    })
    y += 25

    // ── Summary Box ──
    doc.strokeColor("#e5e7eb").lineWidth(1)
    doc.roundedRect(marginLeft, y, contentWidth, 90, 4).stroke()
    y += 10

    const colWidth = contentWidth / 4
    const summaryItems = [
      { label: "Opening Balance", value: formatAmount(data.openingBalance, data.circleCurrency) },
      { label: "Total Inflows", value: formatAmount(data.totalInflows, data.circleCurrency) },
      { label: "Total Outflows", value: formatAmount(data.totalOutflows, data.circleCurrency) },
      { label: "Closing Balance", value: formatAmount(data.closingBalance, data.circleCurrency) },
    ]

    for (let i = 0; i < summaryItems.length; i++) {
      const x = marginLeft + i * colWidth
      doc.fontSize(8).font("Helvetica").fillColor("#6b7280")
      doc.text(summaryItems[i].label, x + 5, y + 5, { width: colWidth - 10, align: "center" })
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827")
      doc.text(summaryItems[i].value, x + 5, y + 20, { width: colWidth - 10, align: "center" })
    }

    y += 75

    // ── Transaction Table ──
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827")
    doc.text("Transactions", marginLeft, y)
    y += 18

    // Table header
    const cols = [
      { label: "Date", x: marginLeft, w: 65 },
      { label: "Type", x: marginLeft + 65, w: 75 },
      { label: "Description", x: marginLeft + 140, w: 165 },
      { label: "Inflow", x: marginLeft + 305, w: 65 },
      { label: "Outflow", x: marginLeft + 370, w: 65 },
      { label: "Balance", x: marginLeft + 435, w: 75 },
    ]

    doc.fontSize(7).font("Helvetica-Bold").fillColor("#374151")
    for (const col of cols) {
      doc.text(col.label, col.x, y, { width: col.w })
    }
    y += 12

    doc.strokeColor("#d1d5db").lineWidth(0.5)
    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke()
    y += 5

    // Table rows
    doc.font("Helvetica").fillColor("#374151")
    for (const tx of data.transactions) {
      checkPage(20)

      const rowHeight = 14
      const descLines = doc.font("Helvetica").heightOfString(truncate(tx.description, 40), {
        width: cols[2].w,
      })
      const lineHeight = Math.max(rowHeight, descLines + 2)

      // Alternate row background
      const rowIdx = data.transactions.indexOf(tx)
      if (rowIdx % 2 === 0) {
        doc.save()
        doc.rect(marginLeft, y - 2, contentWidth, lineHeight + 2).fill("#f9fafb")
        doc.restore()
        doc.font("Helvetica").fillColor("#374151")
      }

      doc.fontSize(7).text(tx.date, cols[0].x, y, { width: cols[0].w })
      doc.text(tx.type, cols[1].x, y, { width: cols[1].w })
      doc.text(truncate(tx.description, 40), cols[2].x, y, { width: cols[2].w })

      if (tx.direction === "inflow") {
        doc.fillColor("#16a34a").text(formatAmount(tx.amount, data.circleCurrency), cols[3].x, y, { width: cols[3].w })
        doc.fillColor("#374151").text("—", cols[4].x, y, { width: cols[4].w })
      } else {
        doc.text("—", cols[3].x, y, { width: cols[3].w })
        doc.fillColor("#dc2626").text(formatAmount(tx.amount, data.circleCurrency), cols[4].x, y, { width: cols[4].w })
        doc.fillColor("#374151")
      }

      doc.fillColor((tx.balance ?? 0) >= 0 ? "#111827" : "#dc2626").font("Helvetica-Bold")
      doc.text(formatAmount(tx.balance ?? 0, data.circleCurrency), cols[5].x, y, { width: cols[5].w })
      doc.font("Helvetica").fillColor("#374151")

      y += lineHeight + 3
    }

    if (data.transactions.length === 0) {
      doc.fontSize(9).font("Helvetica").fillColor("#9ca3af")
      doc.text("No transactions in this period.", marginLeft, y, { align: "center", width: contentWidth })
      y += 20
    }

    // ── Footer ──
    y += 15
    doc.strokeColor("#e5e7eb").lineWidth(1)
    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke()
    y += 10
    doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
    doc.text(
      `This statement was generated by ${APP_NAME} on ${new Date().toISOString().split("T")[0]}.`,
      marginLeft,
      y,
      { align: "center", width: contentWidth }
    )

    // Draw page numbers on all pages
    const pageRange = doc.bufferedPageRange()
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i)
      const footerY = doc.page.height - 35
      doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
      doc.text(
        `Page ${i - pageRange.start + 1} of ${pageRange.count} — ${APP_NAME} Statement`,
        marginLeft,
        footerY,
        { align: "center", width: contentWidth }
      )
    }

    doc.end()
  })
}
