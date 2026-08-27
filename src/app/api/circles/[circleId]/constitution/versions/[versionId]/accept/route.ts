import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { acceptVersion } from "@/lib/services/constitution.service"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; versionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, versionId } = await params
    const acceptance = await acceptVersion({ circleId, userId: session.user.id, versionId })
    return NextResponse.json(acceptance)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 })
  }
}
