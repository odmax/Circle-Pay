import { NextResponse } from "next/server"
import { getCircleByInviteCode, validateInviteCode, joinCircleByInviteCode } from "@/lib/services/invite.service"
import { getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"

export async function GET(_req: Request, { params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params
  const circle = await getCircleByInviteCode(inviteCode)
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const validation = await validateInviteCode(inviteCode)
  return NextResponse.json({
    circle: { id: circle.id, name: circle.name, type: circle.type, memberCount: circle._count.members, owner: circle.createdBy?.name, verification: circle.verification?.status },
    valid: validation.valid, reason: validation.valid ? null : validation.reason,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ inviteCode: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req)
    const { inviteCode } = await params
    return NextResponse.json(await joinCircleByInviteCode(inviteCode, user.id))
  } catch (e: any) { return NextResponse.json({ error: e.message || "Unauthorized" }, { status: 401 }) }
}
