import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendTravelReminders } from "@/lib/services/travel.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId } = await params
    const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
    if (!circle || circle.type !== "TRAVEL") return NextResponse.json({ error: "Not a travel circle" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await sendTravelReminders(circleId, s.user.id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}