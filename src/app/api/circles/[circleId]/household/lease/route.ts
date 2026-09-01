import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { getLeaseRooms, upsertHouseholdLease, setLeaseStatus } from "@/lib/services/household-lease.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const ctx = await getHouseholdCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json({ ...(await getLeaseRooms(circleId, ctx.userId)), isManager: ctx.isManager })
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  try {
    const { circleId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "config"
    const body = await req.json().catch(() => ({}))
    if (action === "status") {
      if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 })
      return NextResponse.json(await setLeaseStatus(circleId, ctx.userId, body.status))
    }
    return NextResponse.json(await upsertHouseholdLease(circleId, ctx.userId, body), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}