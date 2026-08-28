import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { confirmAllocation } from "@/lib/services/grocery.service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ circleId: string; allocationId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, allocationId } = await params
  try {
    const allocation = await confirmAllocation(circleId, allocationId, session.user.id)
    return NextResponse.json({ allocation })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm allocation"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
