import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  getConstitutionOverview,
  listVersionSummaries,
  createDraftVersion,
  updateDraftVersion,
} from "@/lib/services/constitution.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const overview = await getConstitutionOverview(circleId, session.user.id)
    if (!overview.exists) {
      const canView = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.CONSTITUTION_VIEW })
      if (canView) {
        return NextResponse.json({ exists: false, active: null, versions: [] })
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const versions = await listVersionSummaries(circleId, session.user.id)
    return NextResponse.json({ ...overview, versions })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const body = await req.json()
    const version = await createDraftVersion({
      circleId,
      userId: session.user.id,
      content: body.content,
      title: body.title,
      preamble: body.preamble,
    })
    return NextResponse.json(version, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const body = await req.json()
    const version = await updateDraftVersion({
      circleId,
      userId: session.user.id,
      versionId: body.versionId,
      content: body.content,
      title: body.title,
      preamble: body.preamble,
    })
    return NextResponse.json(version)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
