import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getCapitalCallDetail, updateCapitalCall, issueCapitalCall,
  closeCapitalCall, completeCapitalCall, cancelCapitalCall,
} from "@/lib/services/capital-call.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; callId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, callId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(await getCapitalCallDetail(circleId, callId, s.user.id))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; callId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, callId } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "issue"
  const body = await req.json().catch(() => ({}))
  const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CAPITAL_CALL_MANAGE })
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    if (action === "issue") return NextResponse.json(await issueCapitalCall(circleId, callId, s.user.id))
    if (action === "close") return NextResponse.json(await closeCapitalCall(circleId, callId, s.user.id))
    if (action === "complete") return NextResponse.json(await completeCapitalCall(circleId, callId, s.user.id))
    if (action === "cancel") return NextResponse.json(await cancelCapitalCall(circleId, callId, s.user.id))
    if (action === "update") return NextResponse.json(await updateCapitalCall(circleId, callId, s.user.id, body))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}