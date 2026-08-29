import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { addExpense } from "@/lib/services/grocery.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string; campaignId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, campaignId } = await params

  try {
    let title = ""
    let amountRaw = ""
    let date: string | undefined
    let category: string | undefined
    let receiptUrl: string | undefined
    let receiptFilename: string | undefined

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      title = (formData.get("title") as string) || ""
      amountRaw = (formData.get("amount") as string) || ""
      date = (formData.get("date") as string) || undefined
      category = (formData.get("category") as string) || undefined
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
      title = body.title ?? ""
      amountRaw = String(body.amount ?? "")
      date = body.date
      category = body.category
    }

    const amount = Number(amountRaw)
    if (Number.isNaN(amount)) return NextResponse.json({ error: "Invalid expense amount" }, { status: 400 })

    const expense = await addExpense(circleId, campaignId, session.user.id, {
      title,
      amount,
      date,
      category,
      receiptUrl,
      receiptFilename,
    })
    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add expense"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
