import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { addOpportunityDocument } from "@/lib/services/opportunity.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; opportunityId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, opportunityId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { prisma } = await import("@/lib/prisma")
  const docs = await prisma.investmentOpportunityDocument.findMany({ where: { opportunityId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ documents: docs })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; opportunityId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, opportunityId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const name = (formData.get("name") as string) || file?.name || "document"
    if (!file || file.size === 0) return NextResponse.json({ error: "A document file is required" }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    validateProofFile({ size: file.size, type: file.type, name: file.name })
    const result = await uploadProofImage(buffer, file.name, s.user.id, circleId)
    const doc = await addOpportunityDocument(circleId, opportunityId, s.user.id, {
      name,
      url: result.proofUrl,
      mimeType: file.type,
      size: file.size,
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}