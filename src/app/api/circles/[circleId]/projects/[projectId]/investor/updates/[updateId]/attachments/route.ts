import { NextRequest, NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { addUpdateAttachment } from "@/lib/services/investor-relations.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; projectId: string; updateId: string }> },
) {
  try {
    const { circleId, projectId, updateId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_UPDATE_CREATE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file || file.size === 0) return NextResponse.json({ error: "A file is required" }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    validateProofFile({ size: file.size, type: file.type, name: file.name })
    const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
    const att = await addUpdateAttachment(projectId, updateId, ctx.userId, { name: file.name, url: result.proofUrl, mimeType: file.type, size: file.size })
    return NextResponse.json(att, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}