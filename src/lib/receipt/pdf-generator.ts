import PDFDocument from "pdfkit"
import { CURRENCIES, APP_NAME } from "@/lib/constants"

export interface ReceiptPdfData {
  receiptNumber: string
  type: string
  status: string
  circleName: string
  memberName: string
  amount: number
  currency: string
  transactionDate: string
  issuedAt: string
  paymentReference?: string
  description?: string
  approverNames?: string[]
  verificationUrl: string
}

function getCurrencySymbol(currencyCode: string): string {
  const found = CURRENCIES.find((c) => c.code === currencyCode)
  return found?.symbol ?? currencyCode
}

function formatAmount(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol}${formatted}`
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + "…"
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "Verified Receipt",
    VOIDED: "Voided Receipt",
    REPLACED: "Replaced Receipt",
  }
  return map[status] ?? status
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "#16a34a",
    VOIDED: "#dc2626",
    REPLACED: "#d97706",
  }
  return map[status] ?? "#6b7280"
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CONTRIBUTION: "Contribution",
    EXPENSE: "Expense",
    SETTLEMENT: "Settlement",
    WALLET_DEPOSIT: "Wallet Deposit",
    WALLET_WITHDRAWAL: "Wallet Withdrawal",
    WALLET_TRANSFER: "Wallet Transfer",
    PROJECT_PAYMENT: "Project Payment",
    GOAL_ALLOCATION: "Goal Allocation",
    OTHER: "Other",
  }
  return map[type] ?? type
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
      info: {
        Title: `Receipt ${data.receiptNumber}`,
        Author: APP_NAME,
        Subject: `${getTypeLabel(data.type)} Receipt`,
      },
    })

    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width
    const contentWidth = pageWidth - 100
    let y = 50

    // ── Header / Branding ──
    doc.fontSize(24).font("Helvetica-Bold").text(APP_NAME, 50, y, { align: "center" })
    y += 35
    doc.fontSize(10).font("Helvetica").fillColor("#6b7280")
    doc.text("Financial Receipt", 50, y, { align: "center" })
    y += 25

    // Divider line
    doc.strokeColor("#e5e7eb").lineWidth(1)
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).stroke()
    y += 15

    // ── Status Badge ──
    const statusLabel = getStatusLabel(data.status)
    const statusColor = getStatusColor(data.status)
    doc.fontSize(12).font("Helvetica-Bold").fillColor(statusColor)
    doc.text(statusLabel, 50, y, { align: "center", width: contentWidth })
    y += 25

    // ── Receipt Number ──
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#374151")
    doc.text("Receipt Number", 50, y)
    y += 15
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827")
    doc.text(data.receiptNumber, 50, y, { width: contentWidth })
    y += 25

    // Divider
    doc.strokeColor("#f3f4f6").lineWidth(0.5)
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).stroke()
    y += 15

    // ── Detail Fields ──
    function drawField(label: string, value: string) {
      if (y > 720) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
      doc.text(label, 50, y)
      y += 13
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827")
      doc.text(truncate(value, 80), 50, y, { width: contentWidth })
      y += 20
    }

    drawField("Type", getTypeLabel(data.type))
    drawField("Circle", data.circleName)
    drawField("Issued To", data.memberName)

    // Amount (larger)
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
    doc.text("Amount", 50, y)
    y += 13
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#111827")
    doc.text(formatAmount(data.amount, data.currency), 50, y, { width: contentWidth })
    y += 28

    drawField("Transaction Date", data.transactionDate)
    drawField("Issue Date", data.issuedAt)

    if (data.paymentReference) {
      drawField("Payment Reference", data.paymentReference)
    }

    if (data.description) {
      drawField("Description", truncate(data.description, 200))
    }

    // ── Approval Summary ──
    if (data.approverNames && data.approverNames.length > 0) {
      drawField("Approved By", data.approverNames.join(", "))
    }

    // Divider
    doc.strokeColor("#f3f4f6").lineWidth(0.5)
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).stroke()
    y += 15

    // ── Verification URL ──
    if (y > 700) {
      doc.addPage()
      y = 50
    }
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
    doc.text("Verification URL", 50, y)
    y += 13
    doc.fontSize(9).font("Helvetica").fillColor("#2563eb")
    doc.text(truncate(data.verificationUrl, 100), 50, y, {
      width: contentWidth,
      link: data.verificationUrl,
      underline: true,
    })
    y += 25

    // ── Footer ──
    const footerY = Math.max(y + 20, doc.page.height - 70)
    doc.strokeColor("#e5e7eb").lineWidth(1)
    doc.moveTo(50, footerY).lineTo(pageWidth - 50, footerY).stroke()

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#9ca3af")
      .text(
        `This receipt is system-generated by ${APP_NAME}. Verify at ${data.verificationUrl}`,
        50,
        footerY + 10,
        { align: "center", width: contentWidth }
      )

    doc.end()
  })
}
