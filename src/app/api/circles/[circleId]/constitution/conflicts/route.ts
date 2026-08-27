import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getConflicts, resolveConflict } from "@/lib/services/constitution.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const conflicts = await getConflicts(circleId, session.user.id)
    return NextResponse.json(conflicts)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("denied") ? 403 : 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const body = await req.json()
    if (body.conflictId) {
      const conflict = await resolveConflict({
        circleId,
        userId: session.user.id,
        conflictId: body.conflictId,
        resolution: body.resolution,
        action: body.action,
      })
      return NextResponse.json(conflict)
    }
    return NextResponse.json({ error: "conflictId required" }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("denied") ? 403 : 400 })
  }
}
