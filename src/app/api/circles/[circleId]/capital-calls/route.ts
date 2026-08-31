import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listCapitalCalls, createCapitalCall } from "@/lib/services/capital-call.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(await listCapitalCalls(circleId, s.user.id))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CAPITAL_CALL_CREATE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    const call = await createCapitalCall(circleId, s.user.id, body)
    return NextResponse.json(call, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}