import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cancelEvent } from "@/lib/services/event.service"
import { requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { requireCircleAccess } from "@/lib/api/auth"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import type { CircleEventType } from "@/generated/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; eventId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, eventId } = await params

    const { hasFeature } = await import("@/lib/services/feature-gate.service")
    if (!await hasFeature(s.user.id, "EVENTS")) return NextResponse.json({ error: "Events are not available on your plan" }, { status: 403 })

    const access = await requireCircleAccess(circleId)
    if ("error" in access) return access.error

    const event = await prisma.circleEvent.findUnique({
      where: { id: eventId, circleId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        _count: { select: { rsvps: true } },
        rsvps: {
          select: { userId: true, status: true, user: { select: { id: true, name: true, image: true } } },
        },
      },
    })
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(event)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; eventId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, eventId } = await params

    const allowed = await requireCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.EVENT_MANAGE })
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title
    if (body.description !== undefined) data.description = body.description
    if (body.type !== undefined) data.type = body.type as CircleEventType
    if (body.startAt !== undefined) data.startAt = new Date(body.startAt)
    if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null
    if (body.location !== undefined) data.location = body.location
    if (body.isOnline !== undefined) data.isOnline = body.isOnline
    if (body.meetingLink !== undefined) data.meetingLink = body.meetingLink
    if (body.agenda !== undefined) data.agenda = body.agenda
    if (body.amount !== undefined) data.amount = body.amount
    if (body.reminderDate !== undefined) data.reminderDate = body.reminderDate ? new Date(body.reminderDate) : null
    if (body.status !== undefined) data.status = body.status

    const event = await prisma.circleEvent.update({ where: { id: eventId, circleId }, data: data as any })
    return NextResponse.json(event)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("Permission denied")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; eventId: string }> },
) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId, eventId } = await params
    await requireCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.EVENT_MANAGE })
    await cancelEvent(circleId, eventId, s.user.id)
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("Permission denied")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
