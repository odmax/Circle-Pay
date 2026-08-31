import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTravelDashboard, upsertTravelTrip, updateTravelTripStatus } from "@/lib/services/travel.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function ensureTravelCircle(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "TRAVEL") return false
  return true
}

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await ensureTravelCircle(circleId))) return NextResponse.json({ error: "Not a travel circle" }, { status: 404 })
  return NextResponse.json(await getTravelDashboard(circleId, s.user.id))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { circleId } = await params
    if (!(await ensureTravelCircle(circleId))) return NextResponse.json({ error: "Not a travel circle" }, { status: 404 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "config"
    const body = await req.json().catch(() => ({}))

    if (action === "status") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 })
      return NextResponse.json(await updateTravelTripStatus(circleId, s.user.id, body.status))
    }

    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.TRAVEL_TRIP_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await upsertTravelTrip(circleId, s.user.id, body), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}