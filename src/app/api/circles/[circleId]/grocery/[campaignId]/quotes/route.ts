import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { addSupplierQuote } from "@/lib/services/grocery.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params

  try {
    let supplier = ""
    let quoteAmount = ""
    let notes: string | undefined
    let quoteDocUrl: string | undefined
    let quoteDocFilename: string | undefined

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      supplier = (formData.get("supplier") as string) || ""
      quoteAmount = (formData.get("quoteAmount") as string) || ""
      notes = (formData.get("notes") as string) || undefined
      const file = formData.get("file") as File | null
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        validateProofFile({ size: file.size, type: file.type, name: file.name })
        const result = await uploadProofImage(buffer, file.name, session.user.id, circleId)
        quoteDocUrl = result.proofUrl
        quoteDocFilename = file.name
      }
    } else {
      const body = await req.json()
      supplier = body.supplier ?? ""
      quoteAmount = String(body.quoteAmount ?? "")
      notes = body.notes
    }

    const amount = Number(quoteAmount)
    if (Number.isNaN(amount)) return NextResponse.json({ error: "Invalid quote amount" }, { status: 400 })

    const quote = await addSupplierQuote(circleId, campaignId, session.user.id, {
      supplier,
      quoteAmount: amount,
      quoteDocUrl,
      quoteDocFilename,
      notes,
    })
    return NextResponse.json({ quote }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add supplier quote"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
