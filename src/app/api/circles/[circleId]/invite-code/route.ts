import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { regenerateInviteCode, disableInviteCode, enableInviteCode, setInviteCodeExpiry, trackInviteCopied, trackInviteShared, trackInviteViewed } from "@/lib/services/invite.service"

async function checkAccess(circleId: string, userId: string) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) throw new Error("Forbidden")
}

async function handle(req: Request, { params }: { params: Promise<{ circleId: string }> }, action: string) {
  const s = await auth()
  const { circleId } = await params

  // Public tracking actions don't need admin access
  if (action === "track-copy" || action === "track-share" || action === "track-view") {
    if (s?.user?.id) {
      const c = await prisma.circle.findUnique({ where: { id: circleId }, select: { inviteCode: true } })
      if (c) {
        if (action === "track-copy") await trackInviteCopied(c.inviteCode, s.user.id)
        if (action === "track-share") await trackInviteShared(c.inviteCode, s.user.id)
        if (action === "track-view") await trackInviteViewed(c.inviteCode, s.user.id)
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    await checkAccess(circleId, s.user.id)
    if (action === "regenerate") return NextResponse.json(await regenerateInviteCode(circleId, s.user.id))
    if (action === "disable") return NextResponse.json(await disableInviteCode(circleId, s.user.id))
    if (action === "enable") return NextResponse.json(await enableInviteCode(circleId, s.user.id))
    if (action === "set-expiry") {
      const { expiresAt } = await req.json()
      return NextResponse.json(await setInviteCodeExpiry(circleId, s.user.id, expiresAt || null))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
}

export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string }> }) => {
  const { action } = await req.json().catch(() => ({ action: undefined }))
  return handle(req, ctx, action || new URL(req.url).pathname.split("/").pop() || "")
}
