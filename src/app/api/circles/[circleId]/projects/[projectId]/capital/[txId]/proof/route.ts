import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { submitCapitalTransaction } from "@/lib/services/project-capital.service"
import { addProjectActivity } from "@/lib/services/project.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; projectId: string; txId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId, txId } = await params

    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)

    const tx = await prisma.projectCapitalTransaction.findUnique({
      where: { id: txId },
      include: { participant: { select: { userId: true } } },
    })
    if (!tx || tx.projectId !== projectId) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    // Members may only submit proof for their own investment; a manager may act on behalf.
    if (tx.participant.userId && tx.participant.userId !== s.user.id) {
      const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.FUNDING_RECORD })
      if (!canManage) return NextResponse.json({ error: "You can only submit proof for your own transaction" }, { status: 403 })
    }

    let proofUrl: string | undefined
    let reference: string | undefined

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      reference = (formData.get("reference") as string) || undefined
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        validateProofFile({ size: file.size, type: file.type, name: file.name })
        const result = await uploadProofImage(buffer, file.name, s.user.id, circleId)
        proofUrl = result.proofUrl
      }
    } else {
      const body = await req.json().catch(() => ({}))
      reference = body.reference || undefined
    }

    const updated = await submitCapitalTransaction(txId, s.user.id, { proofUrl, reference })
    if (proofUrl || reference) {
      await addProjectActivity(projectId, s.user.id, "capital_proof_submitted", "Capital proof submitted", reference)
    }
    return NextResponse.json(updated, { status: 201 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own transaction") ? 403 : 400 })
  }
}