import { NextRequest, NextResponse } from "next/server"
import { verifyReceipt } from "@/lib/services/receipt.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const result = await verifyReceipt(token)

    if (!result.valid) {
      return NextResponse.json({ valid: false, receipt: null })
    }

    const receipt = result.receipt
    const response: Record<string, unknown> = {
      valid: true,
      receipt: {
        receiptNumber: receipt.receiptNumber,
        type: receipt.type,
        amount: receipt.amount,
        currency: receipt.currency,
        transactionDate: receipt.transactionDate,
        issuedAt: receipt.issuedAt,
        status: receipt.status,
        circleName: receipt.circleName,
      },
    }

    if (receipt.status === "VOIDED" && receipt.voidReason) {
      ;(response.receipt as Record<string, unknown>).voidReason = receipt.voidReason
    }

    return NextResponse.json(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to verify receipt"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
