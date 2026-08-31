import { NextRequest, NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { listInvestorDocuments, addInvestorDocument } from "@/lib/services/investor-relations.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json({ documents: await listInvestorDocuments(projectId, circleId, ctx) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  try {
    const { circleId, projectId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_DOCUMENT_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const name = (formData.get("name") as string) || file?.name || "document"
    const category = (formData.get("category") as string) || "OTHER"
    const visibility = (formData.get("visibility") as string) || "INVESTORS_ONLY"
    const description = (formData.get("description") as string) || undefined
    const milestoneId = (formData.get("milestoneId") as string) || null

    if (!file || file.size === 0) return NextResponse.json({ error: "A document file is required" }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    validateProofFile({ size: file.size, type: file.type, name: file.name })
    const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
    const doc = await addInvestorDocument(circleId, projectId, ctx.userId, {
      name, url: result.proofUrl, category, visibility, description, mimeType: file.type, size: file.size, milestoneId,
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}