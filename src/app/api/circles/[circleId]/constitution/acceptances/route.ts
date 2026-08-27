import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listAcceptances } from "@/lib/services/constitution.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId } = await params
    const versionId = req.nextUrl.searchParams.get("versionId") || undefined
    const rows = await listAcceptances(circleId, session.user.id, versionId)
    return NextResponse.json(rows)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("denied") ? 403 : 500 })
  }
}
