import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleStatements } from "@/lib/services/year-end-close.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; closeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, closeId } = await params
  const url = new URL(req.url)
  const memberUserId = url.searchParams.get("memberUserId") ?? undefined
  try {
    const statements = await getCircleStatements(circleId, session.user.id, { memberUserId, closeId })
    return NextResponse.json({ statements })
  } catch (error) {
    console.error("Error fetching year-end statements:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch statements"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
