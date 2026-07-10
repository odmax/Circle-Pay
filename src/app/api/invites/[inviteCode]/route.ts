import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getCircleByInviteCode, validateInviteCode, trackInviteViewed } from "@/lib/services/invite.service"

export async function GET(_req: Request, { params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params
  const circle = await getCircleByInviteCode(inviteCode)
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const s = await auth()
  trackInviteViewed(inviteCode, s?.user?.id).catch(() => {})
  const validation = await validateInviteCode(inviteCode)
  return NextResponse.json({
    circle: {
      id: circle.id, name: circle.name, type: circle.type, visibility: circle.visibility,
      currency: circle.currency, country: circle.country, city: circle.city,
      publicDescription: circle.publicDescription, rules: circle.rules,
      memberCount: circle._count.members,
      owner: circle.createdBy ? { name: circle.createdBy.name || circle.createdBy.email } : null,
      verification: circle.verification?.status || null,
      reputation: circle.reputation?.score || null,
      joinApprovalRequired: circle.joinApprovalRequired,
      createdAt: circle.createdAt,
      joinQuestions: (circle.settings as any)?.joinQuestions || [],
    },
    valid: validation.valid,
    reason: validation.valid ? null : validation.reason || null,
  })
}
