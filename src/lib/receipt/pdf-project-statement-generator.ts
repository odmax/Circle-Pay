import PDFDocument from "pdfkit"
import { CURRENCIES, APP_NAME } from "@/lib/constants"

export interface ProjectStatementItem {
  date: string
  amount: number
  status: string
  reference?: string | null
}

export interface ProjectStatementPdfData {
  circleName: string
  projectName: string
  memberName: string
  currency: string
  generatedAt: string
  summary: {
    invested: number
    ownershipPercent: number
    currentValue: number
    profitLoss: number
    roi: number
    distributionsReceived: number
    pendingDistributions: number
  }
  contributions: ProjectStatementItem[]
  distributions: ProjectStatementItem[]
}

function getCurrencySymbol(currencyCode: string): string {
  return CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? currencyCode
}

function formatAmount(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  return `${symbol}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function generateProjectMemberStatementPdf(data: ProjectStatementPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
      bufferPages: true,
      info: { Title: `Investment Statement — ${data.projectName}`, Author: APP_NAME },
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

    // Header
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#111827")
    doc.text(APP_NAME, marginLeft, y, { align: "center", width: contentWidth })
    y += 28
    doc.fontSize(12).font("Helvetica").fillColor("#6b7280")
    doc.text(`Project Investment Statement — ${data.memberName}`, marginLeft, y, { align: "center", width: contentWidth })
    y += 18
    doc.fontSize(10).font("Helvetica").fillColor("#374151")
    doc.text(`${data.projectName} · ${data.circleName}`, marginLeft, y, { align: "center", width: contentWidth })
    y += 14
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
    doc.text(`Generated ${data.generatedAt}`, marginLeft, y, { align: "center", width: contentWidth })
    y += 25

    // Summary box
    doc.strokeColor("#e5e7eb").lineWidth(1)
    doc.roundedRect(marginLeft, y, contentWidth, 130, 4).stroke()
    y += 10
    const items = [
      { label: "Invested", value: formatAmount(data.summary.invested, data.currency) },
      { label: "Ownership", value: `${data.summary.ownershipPercent.toFixed(2)}%` },
      { label: "Current Value", value: formatAmount(data.summary.currentValue, data.currency) },
      { label: "Profit / Loss", value: formatAmount(data.summary.profitLoss, data.currency) },
      { label: "ROI", value: `${data.summary.roi}%` },
      { label: "Distributions Received", value: formatAmount(data.summary.distributionsReceived, data.currency) },
    ]
    const colWidth = contentWidth / 3
    for (let i = 0; i < 6; i++) {
      const x = marginLeft + (i % 3) * colWidth
      const row = Math.floor(i / 3)
      const yy = y + 5 + row * 55
      doc.fontSize(8).font("Helvetica").fillColor("#6b7280")
      doc.text(items[i].label, x + 5, yy, { width: colWidth - 10, align: "center" })
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827")
      doc.text(items[i].value, x + 5, yy + 15, { width: colWidth - 10, align: "center" })
    }
    y += 130

    doc.fontSize(9).font("Helvetica").fillColor("#374151")
    doc.text(`Pending distributions: ${formatAmount(data.summary.pendingDistributions, data.currency)}`, marginLeft, y)
    y += 20

    function renderTable(title: string, rows: ProjectStatementItem[], heading: string[]) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827")
      doc.text(title, marginLeft, y)
      y += 16
      const cols = [
        { label: "Date", x: marginLeft, w: 90 },
        { label: heading[1], x: marginLeft + 90, w: 100 },
        { label: heading[2], x: marginLeft + 260, w: 90 },
        { label: "Status", x: marginLeft + 350, w: 90 },
      ]
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#374151")
      for (const c of cols) doc.text(c.label, c.x, y, { width: c.w })
      y += 12
      doc.strokeColor("#d1d5db").lineWidth(0.5)
      doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke()
      y += 5

      doc.font("Helvetica").fillColor("#374151")
      if (rows.length === 0) {
        doc.fontSize(9).font("Helvetica").fillColor("#9ca3af")
        doc.text("None recorded.", marginLeft, y, { width: contentWidth })
        y += 20
        return
      }
      rows.forEach((row, i) => {
        checkPage(18)
        if (i % 2 === 0) {
          doc.save()
          doc.rect(marginLeft, y - 2, contentWidth, 14).fill("#f9fafb")
          doc.restore()
          doc.font("Helvetica").fillColor("#374151")
        }
        const text = row.reference || (heading[0] === "Amount" ? formatAmount(row.amount, data.currency) : row.reference || "")
        doc.fontSize(7).text(row.date.split("T")[0], cols[0].x, y, { width: cols[0].w })
        doc.text(text, cols[1].x, y, { width: cols[1].w })
        doc.text(formatAmount(row.amount, data.currency), cols[2].x, y, { width: cols[2].w })
        doc.text(row.status, cols[3].x, y, { width: cols[3].w })
        y += 17
      })
      y += 12
    }

    renderTable("My Contribution / Investment History", data.contributions, ["Amount", "Amount", "Amount"])
    y += 8
    renderTable("My Distributions", data.distributions, ["Distribution", "Amount", "Amount"])

    // Footer
    y += 15
    doc.strokeColor("#e5e7eb").lineWidth(1)
    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke()
    y += 10
    doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
    doc.text(`Generated by ${APP_NAME}. Live data only — this is not financial advice.`, marginLeft, y, { align: "center", width: contentWidth })

    const pageRange = doc.bufferedPageRange()
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i)
      const footerY = doc.page.height - 35
      doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
      doc.text(`Page ${i - pageRange.start + 1} of ${pageRange.count} — ${APP_NAME}`, marginLeft, footerY, { align: "center", width: contentWidth })
    }

    doc.end()
  })
}