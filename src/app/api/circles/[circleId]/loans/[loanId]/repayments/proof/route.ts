import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordLoanRepaymentProof } from "@/lib/services/loan.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; loanId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, loanId } = await params

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Proof must be uploaded as multipart form data" }, { status: 400 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const scheduleId = (formData.get("scheduleId") as string) || ""
    const amountRaw = formData.get("amount") as string | null
    const reference = (formData.get("reference") as string) || undefined
    const note = (formData.get("note") as string) || undefined

    if (!file) return NextResponse.json({ error: "A proof file is required" }, { status: 400 })
    if (!scheduleId) return NextResponse.json({ error: "scheduleId is required" }, { status: 400 })

    // Validate + store via the shared upload infrastructure (max 5MB, JPEG/PNG/WebP/HEIC/PDF).
    const buffer = Buffer.from(await file.arrayBuffer())
    validateProofFile({ size: file.size, type: file.type, name: file.name })
    const result = await uploadProofImage(buffer, file.name, session.user.id)

    const amount = amountRaw != null && amountRaw !== "" ? Number(amountRaw) : undefined
    if (amount != null && Number.isNaN(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const { repayment, proof } = await recordLoanRepaymentProof(circleId, loanId, session.user.id, {
      scheduleId,
      amount,
      fileUrl: result.proofUrl,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      reference,
      note,
    })
    return NextResponse.json({ repayment, proof }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    const status = message.includes("denied") || message.includes("only upload proof for your own loan") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
