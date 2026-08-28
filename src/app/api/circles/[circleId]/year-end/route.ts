import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { initiateYearEndClose, listYearEndCloses } from "@/lib/services/year-end-close.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const data = await listYearEndCloses(circleId, session.user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error listing year-end closes:", error)
    const message = error instanceof Error ? error.message : "Failed to list year-end closes"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  try {
    const close = await initiateYearEndClose(circleId, session.user.id, {
      periodStart: typeof body.periodStart === "string" ? body.periodStart : undefined,
      periodEnd: typeof body.periodEnd === "string" ? body.periodEnd : undefined,
    })
    return NextResponse.json({ close }, { status: 201 })
  } catch (error) {
    console.error("Error initiating year-end close:", error)
    const message = error instanceof Error ? error.message : "Failed to initiate year-end close"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
