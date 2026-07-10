import { prisma } from "@/lib/prisma"

function generateCode(): string {
  return Array.from({ length: 8 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")
}

export async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const exists = await prisma.circle.findUnique({ where: { inviteCode: code } })
    if (!exists) return code
  }
  return generateCode() + generateCode().slice(0, 4) // 12-char fallback
}

async function trackEvent(circleId: string, inviteCode: string, eventType: string, userId?: string, metadata?: Record<string, unknown>) {
  try { await prisma.circleInviteEvent.create({ data: { circleId, inviteCode, eventType: eventType as any, userId: userId || null, metadata: metadata as any || undefined } }) } catch {}
}

export async function getCircleByInviteCode(code: string) {
  const upperCode = code.toUpperCase().trim()
  const circle = await prisma.circle.findUnique({ where: { inviteCode: upperCode }, include: { createdBy: { select: { id: true, name: true, email: true } }, _count: { select: { members: true } }, verification: { select: { status: true } }, reputation: { select: { score: true } } } })
  return circle
}

export async function validateInviteCode(code: string, userId?: string) {
  const circle = await getCircleByInviteCode(code)
  if (!circle) return { valid: false, reason: "invalid_code" as const }
  if (!circle.inviteCodeEnabled) return { valid: false, reason: "code_disabled" as const }
  if (circle.inviteCodeExpiresAt && new Date(circle.inviteCodeExpiresAt) < new Date()) return { valid: false, reason: "code_expired" as const }
  if (!circle.isActive) return { valid: false, reason: "circle_inactive" as const }
  return { valid: true, circle }
}

export async function joinCircleByInviteCode(code: string, userId: string, answers?: Record<string, string>): Promise<{ status: string; message?: string }> {
  const upperCode = code.toUpperCase().trim()
  const circle = await prisma.circle.findUnique({ where: { inviteCode: upperCode }, include: { _count: { select: { members: true } } } })
  if (!circle || !circle.isActive || !circle.inviteCodeEnabled) return { status: "error", message: "Invalid or disabled invite code" }
  if (circle.inviteCodeExpiresAt && new Date(circle.inviteCodeExpiresAt) < new Date()) return { status: "error", message: "This invite code has expired" }

  const existingMember = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId: circle.id, userId } } })
  if (existingMember) return { status: "already_member", message: "You are already a member" }

  if (circle.joinApprovalRequired) {
    const existingRequest = await prisma.joinRequest.findUnique({ where: { circleId_userId: { circleId: circle.id, userId } } })
    if (existingRequest) return { status: "request_pending", message: "Your join request is pending approval" }
    await prisma.joinRequest.create({ data: { circleId: circle.id, userId, answers: answers || null as any } })
    trackEvent(circle.id, upperCode, "REQUESTED", userId)
    await createAuditLog({ userId, circleId: circle.id, action: "INVITE_CODE_REQUESTED", entityType: "JoinRequest", entityId: circle.id })
    return { status: "request_sent", message: "Join request submitted" }
  }

  await prisma.circleMember.create({ data: { circleId: circle.id, userId, role: "MEMBER" } })
  trackEvent(circle.id, upperCode, "JOINED", userId)
  await createAuditLog({ userId, circleId: circle.id, action: "INVITE_CODE_JOINED", entityType: "CircleMember", entityId: circle.id })
  return { status: "joined", message: "Successfully joined" }
}

export async function regenerateInviteCode(circleId: string, userId: string) {
  const code = await generateUniqueInviteCode()
  await prisma.circle.update({ where: { id: circleId }, data: { inviteCode: code } })
  trackEvent(circleId, code, "REGENERATED", userId)
  await createAuditLog({ userId, circleId, action: "INVITE_CODE_REGENERATED", entityType: "Circle", entityId: circleId })
  return { inviteCode: code }
}

export async function disableInviteCode(circleId: string, userId: string) {
  await prisma.circle.update({ where: { id: circleId }, data: { inviteCodeEnabled: false } })
  const c = await prisma.circle.findUnique({ where: { id: circleId }, select: { inviteCode: true } })
  trackEvent(circleId, c?.inviteCode || "", "DISABLED", userId)
  await createAuditLog({ userId, circleId, action: "INVITE_CODE_DISABLED", entityType: "Circle", entityId: circleId })
  return { ok: true }
}

export async function enableInviteCode(circleId: string, userId: string) {
  await prisma.circle.update({ where: { id: circleId }, data: { inviteCodeEnabled: true } })
  const c = await prisma.circle.findUnique({ where: { id: circleId }, select: { inviteCode: true } })
  trackEvent(circleId, c?.inviteCode || "", "ENABLED", userId)
  await createAuditLog({ userId, circleId, action: "INVITE_CODE_ENABLED", entityType: "Circle", entityId: circleId })
  return { ok: true }
}

export async function setInviteCodeExpiry(circleId: string, userId: string, expiresAt: string | null) {
  await prisma.circle.update({ where: { id: circleId }, data: { inviteCodeExpiresAt: expiresAt ? new Date(expiresAt) : null } })
  return { ok: true }
}

export async function trackInviteCopied(code: string, userId?: string) {
  const c = await prisma.circle.findUnique({ where: { inviteCode: code.toUpperCase().trim() }, select: { id: true } })
  if (c) trackEvent(c.id, code.toUpperCase().trim(), "COPIED", userId)
}

export async function trackInviteShared(code: string, userId?: string) {
  const c = await prisma.circle.findUnique({ where: { inviteCode: code.toUpperCase().trim() }, select: { id: true } })
  if (c) trackEvent(c.id, code.toUpperCase().trim(), "SHARED", userId)
}

export async function trackInviteViewed(code: string, userId?: string) {
  const c = await prisma.circle.findUnique({ where: { inviteCode: code.toUpperCase().trim() }, select: { id: true } })
  if (c) trackEvent(c.id, code.toUpperCase().trim(), "VIEWED", userId)
}

export async function getInviteAnalytics(circleId: string) {
  const events = await prisma.circleInviteEvent.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 50 })
  return {
    totalViews: events.filter((e) => e.eventType === "VIEWED").length,
    totalJoins: events.filter((e) => e.eventType === "JOINED").length,
    totalRequests: events.filter((e) => e.eventType === "REQUESTED").length,
    totalShared: events.filter((e) => e.eventType === "SHARED").length,
    totalCopied: events.filter((e) => e.eventType === "COPIED").length,
    recent: events.slice(0, 10),
  }
}

async function createAuditLog(data: { userId: string; circleId: string; action: string; entityType: string; entityId: string }) {
  try { await prisma.auditLog.create({ data: data as any }) } catch {}
}
