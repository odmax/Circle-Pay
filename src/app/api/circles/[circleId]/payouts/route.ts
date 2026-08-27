import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getPayoutQueue,
  getPayoutConfig,
  getPayoutHistory,
  createPayoutQueue,
  drawRandomPayout,
  upsertPayoutConfig,
} from "@/lib/services/payout-rotation.service"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "queue"

    if (view === "history") {
      const history = await getPayoutHistory(circleId, session.user.id)
      return NextResponse.json(history)
    }

    if (view === "config") {
      const config = await getPayoutConfig(circleId)
      return NextResponse.json(
        config ? { ...config, amount: config.amount ? Number(config.amount) : null } : null
      )
    }

    const data = await getPayoutQueue(circleId, session.user.id)
    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch payouts"
    const status = msg === "Not a member of this circle" || msg === "Insufficient permissions"
      ? 403
      : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "create"

    if (action === "draw") {
      const result = await drawRandomPayout(circleId, session.user.id, true)
      return NextResponse.json(result)
    }

    if (action === "config") {
      const body = await req.json().catch(() => ({}))
      const config = await upsertPayoutConfig(circleId, session.user.id, body)
      return NextResponse.json({
        ...config,
        amount: config.amount ? Number(config.amount) : null,
      })
    }

    const result = await createPayoutQueue(circleId, session.user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to manage payouts"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Not a stokvel circle"
        ? msg === "Not a stokvel circle" ? 400 : 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
