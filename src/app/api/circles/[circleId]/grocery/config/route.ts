import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGroceryConfig, upsertGroceryConfig } from "@/lib/services/grocery.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const config = await getGroceryConfig(circleId, session.user.id)
    return NextResponse.json({ config })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load config"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const body = await req.json()
    const row = await upsertGroceryConfig(circleId, session.user.id, { enabled: !!body.enabled })
    return NextResponse.json({ config: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update config"
    const status = message.includes("denied") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
