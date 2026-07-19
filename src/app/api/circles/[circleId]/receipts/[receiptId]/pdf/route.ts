import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { getReceiptById } from "@/lib/services/receipt.service"
import { generateReceiptPdf } from "@/lib/receipt/pdf-generator"
import { APP_URL } from "@/lib/constants"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; receiptId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, receiptId } = await params

    const receipt = await getReceiptById(receiptId)
    if (!receipt || receipt.circleId !== circleId) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    const isOwner = receipt.issuedToUserId === session.user.id
    if (!isOwner) {
      const canExport = await hasCirclePermission({
        userId: session.user.id,
        circleId,
        permission: CIRCLE_PERMISSIONS.REPORT_EXPORT,
      })
      if (!canExport) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const metadata = (receipt.metadata ?? {}) as Record<string, unknown>
    const approverNamesRaw = metadata.approverNames as string | string[] | null | undefined
    const approverNames = Array.isArray(approverNamesRaw)
      ? approverNamesRaw
      : approverNamesRaw
        ? [approverNamesRaw]
        : undefined

    const pdfBuffer = await generateReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      type: receipt.type,
      status: receipt.status,
      circleName: receipt.circle.name,
      memberName: receipt.issuedTo.name || receipt.issuedTo.email,
      amount: Number(receipt.amount),
      currency: receipt.currency,
      transactionDate: receipt.transactionDate.toISOString().split("T")[0],
      issuedAt: receipt.issuedAt.toISOString().split("T")[0],
      paymentReference: receipt.paymentReference ?? undefined,
      description: receipt.description ?? undefined,
      approverNames,
      verificationUrl: `${APP_URL}/receipts/verify/${receipt.verificationToken}`,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate receipt PDF"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
