import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getYearEndConfig, upsertYearEndConfig } from "@/lib/services/year-end-close.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const config = await getYearEndConfig(circleId, session.user.id)
    return NextResponse.json({ config })
  } catch (error) {
    console.error("Error fetching year-end config:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch config"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const body = (await req.json()) as {
    fiscalYearEndMonth?: number
    fiscalYearEndDay?: number
    autoNotifyMembers?: boolean
    requireApproval?: boolean
  }
  try {
    const config = await upsertYearEndConfig(circleId, session.user.id, {
      fiscalYearEndMonth: body.fiscalYearEndMonth,
      fiscalYearEndDay: body.fiscalYearEndDay,
      autoNotifyMembers: body.autoNotifyMembers,
      requireApproval: body.requireApproval,
    })
    return NextResponse.json({ config })
  } catch (error) {
    console.error("Error updating year-end config:", error)
    const message = error instanceof Error ? error.message : "Failed to update config"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
