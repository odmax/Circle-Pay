import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { activateVersion } from "@/lib/services/constitution.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; versionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, versionId } = await params
    const body = await req.json().catch(() => ({}))
    const version = await activateVersion({
      circleId,
      userId: session.user.id,
      versionId,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
    })
    return NextResponse.json(version)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
