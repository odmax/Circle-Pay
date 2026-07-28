import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createProjectAsset, markAssetSold, updateAssetValue, calculateAssetDepreciation } from "@/lib/services/project-roi.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)

    const assets = await prisma.projectAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(assets)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, projectId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await requireProjectInCircle(projectId, circleId)

    const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const action = url.searchParams.get("action")

    if (action === "sold") {
      const { assetId, saleValue } = await req.json()
      return NextResponse.json(await markAssetSold(assetId, s.user.id, saleValue))
    }
    if (action === "update-value") {
      const { assetId, currentValue } = await req.json()
      return NextResponse.json(await updateAssetValue(assetId, s.user.id, currentValue))
    }
    if (action === "depreciate") {
      const { assetId } = await req.json()
      return NextResponse.json(await calculateAssetDepreciation(assetId))
    }

    const data = await req.json()
    return NextResponse.json(await createProjectAsset(projectId, circleId, s.user.id, data), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
