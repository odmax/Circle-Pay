import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getOpportunityDetail, updateOpportunity, openOpportunity, approveOpportunity,
  recordOpportunityVotePassed, closeOpportunity, cancelOpportunity, convertOpportunityToProject,
} from "@/lib/services/opportunity.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; opportunityId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, opportunityId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // Only managers see the full commitment ledger; members see their own + totals.
  const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_MANAGE })
  const canApprove = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_APPROVE })
  const detail = await getOpportunityDetail(circleId, opportunityId, s.user.id)
  if (!canManage && !canApprove) detail.commitments = detail.commitments.filter((c) => c.userId === s.user.id)
  return NextResponse.json({ ...detail, viewerId: s.user.id })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; opportunityId: string }> }) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, opportunityId } = await params
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await updateOpportunity(circleId, opportunityId, s.user.id, body))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; opportunityId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, opportunityId } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "open"
  const body = await req.json().catch(() => ({}))
  const canManage = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_MANAGE })
  const canApprove = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.OPPORTUNITY_APPROVE })

  try {
    if (action === "approve") {
      if (!canApprove) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return NextResponse.json(await approveOpportunity(circleId, opportunityId, s.user.id))
    }
    if (action === "record-vote-passed") {
      if (!canApprove) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return NextResponse.json(await recordOpportunityVotePassed(circleId, opportunityId, s.user.id))
    }
    if (!canManage && !(action === "open" && canApprove)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (action === "open") return NextResponse.json(await openOpportunity(circleId, opportunityId, s.user.id))
    if (action === "close") return NextResponse.json(await closeOpportunity(circleId, opportunityId, s.user.id))
    if (action === "cancel") return NextResponse.json(await cancelOpportunity(circleId, opportunityId, s.user.id))
    if (action === "convert") return NextResponse.json(await convertOpportunityToProject(circleId, opportunityId, s.user.id))
    if (action === "update") return NextResponse.json(await updateOpportunity(circleId, opportunityId, s.user.id, body))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}