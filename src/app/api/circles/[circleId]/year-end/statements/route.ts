import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMemberStatements } from "@/lib/services/year-end-close.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const statements = await getMemberStatements(circleId, session.user.id)
    return NextResponse.json({ statements })
  } catch (error) {
    console.error("Error fetching member statements:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch statements"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
