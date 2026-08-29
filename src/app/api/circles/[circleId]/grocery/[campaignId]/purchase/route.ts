import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordPurchase } from "@/lib/services/grocery.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params

  try {
    let supplier: string | undefined
    let purchaseAmount = ""
    let purchaseDate: string | undefined
    let paymentReference: string | undefined
    let receiptUrl: string | undefined
    let receiptFilename: string | undefined

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      supplier = (formData.get("supplier") as string) || undefined
      purchaseAmount = (formData.get("purchaseAmount") as string) || ""
      purchaseDate = (formData.get("purchaseDate") as string) || undefined
      paymentReference = (formData.get("paymentReference") as string) || undefined
      const file = formData.get("file") as File | null
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        validateProofFile({ size: file.size, type: file.type, name: file.name })
        const result = await uploadProofImage(buffer, file.name, session.user.id, circleId)
        receiptUrl = result.proofUrl
        receiptFilename = file.name
      }
    } else {
      const body = await req.json()
      supplier = body.supplier
      purchaseAmount = String(body.purchaseAmount ?? "")
      purchaseDate = body.purchaseDate
      paymentReference = body.paymentReference
    }

    const amount = Number(purchaseAmount)
    if (Number.isNaN(amount)) return NextResponse.json({ error: "Invalid purchase amount" }, { status: 400 })

    const purchase = await recordPurchase(circleId, campaignId, session.user.id, {
      supplier,
      purchaseAmount: amount,
      purchaseDate,
      paymentReference,
      receiptUrl,
      receiptFilename,
    })
    return NextResponse.json({ purchase }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record purchase"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
