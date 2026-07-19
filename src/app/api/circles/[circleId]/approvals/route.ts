import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import {
  getPendingApprovals,
  getApprovalHistory,
  createApprovalRequest,
} from "@/lib/services/approval.service"
import type { ApprovalType, ApprovalStatus } from "@/generated/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const canView = await hasCirclePermission({
      userId: session.user.id,
      circleId,
      permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW,
    })
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const type = searchParams.get("type") as ApprovalType | null
    const search = searchParams.get("search") ?? undefined
    const status = searchParams.get("status") as ApprovalStatus | null
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined

    if (status && status !== "PENDING") {
      const result = await getApprovalHistory(circleId, {
        type: type ?? undefined,
        status,
        search,
        limit,
        offset,
      })
      return NextResponse.json(result)
    }

    const approvals = await getPendingApprovals(circleId, {
      type: type ?? undefined,
      search,
    })
    return NextResponse.json({ requests: approvals, total: approvals.length, hasMore: false })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch approvals"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const body = await req.json()
    const { type, resourceId, title, description, amount, currency, metadata } = body as {
      type: ApprovalType
      resourceId?: string
      title: string
      description?: string
      amount?: number
      currency?: string
      metadata?: Record<string, unknown>
    }

    if (!type || !title) {
      return NextResponse.json({ error: "type and title are required" }, { status: 400 })
    }

    const approvalRequest = await createApprovalRequest({
      circleId,
      type,
      resourceId,
      title,
      description,
      requestedById: session.user.id,
      amount,
      currency,
      metadata,
    })

    return NextResponse.json(approvalRequest, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create approval request"
    const status = msg.includes("Permission denied") ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
