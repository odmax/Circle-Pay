import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listSettlements, createSettlement } from "@/lib/services/balance.service"
import { createSettlementSchema } from "@/lib/validations/balances"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const url = new URL(req.url)
    const status = url.searchParams.get("status") || undefined
    const settlements = await listSettlements(circleId, session.user.id, status)
    return NextResponse.json(settlements)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("Not") ? 403 : 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const body = await req.json()
    const parsed = createSettlementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const settlement = await createSettlement(circleId, session.user.id, parsed.data)
    return NextResponse.json(settlement, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("permission") || msg.includes("authorized") ? 403 : msg.includes("exceed") ? 400 : 500 })
  }
}
