import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleBalances } from "@/lib/services/balance.service"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const data = await getCircleBalances(circleId, session.user.id)
    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("Not") ? 403 : 500 })
  }
}
